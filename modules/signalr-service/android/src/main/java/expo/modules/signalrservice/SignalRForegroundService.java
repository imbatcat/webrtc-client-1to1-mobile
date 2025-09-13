package expo.modules.signalrservice;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Binder;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.microsoft.signalr.HttpHubConnectionBuilder;
import com.microsoft.signalr.HubConnection;
import com.microsoft.signalr.HubConnectionBuilder;
import com.microsoft.signalr.HubConnectionState;
import com.microsoft.signalr.TransportEnum;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.Map;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;

public class SignalRForegroundService extends Service {

    public interface EventListener {
        void onEvent(String eventType, Object payload);
    }

    public static final String TAG = "SignalRFGS";
    private static final boolean VERBOSE_LOGGING = false; // Set to false in production

    public static final String INTENT_EXTRA_HUB_URL = "hubUrl";
    public static final String INTENT_EXTRA_ACCESS_TOKEN = "accessToken";
    public static final String INTENT_EXTRA_GROUPS = "groups"; // ArrayList<String>
    public static final String INTENT_EXTRA_KEEP_ALIVE_MS = "keepAliveMs"; // long
    public static final String INTENT_EXTRA_SERVER_TIMEOUT_MS = "serverTimeoutMs"; // long
    public static final String INTENT_EXTRA_NOTIFICATION_TITLE = "notificationTitle";
    public static final String INTENT_EXTRA_NOTIFICATION_TEXT = "notificationText";

    private static final String CHANNEL_ID = "signalr_foreground_channel";
    private static final int NOTIFICATION_ID = 1001;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    private HubConnection hubConnection;
    private String hubUrl;
    private String accessToken;
    private long keepAliveMs = 30_000L; // default 30s
    private long serverTimeoutMs = 60_000L; // default 60s (align with JS default)
    private final Set<String> groups = new HashSet<>();
    private int reconnectAttempts = 0;
    private final int maxReconnectAttempts = 5;

    private final Map<String, Set<EventListener>> hubConnectionCallbacks = new HashMap<>(); // eventName -> callbacks

    private ScheduledFuture<?> startTimeoutFuture;
    private ScheduledFuture<?> pingFuture;
    private static final long PING_INTERVAL_MS = 15_000L;

    private final IBinder binder = new LocalBinder();

    public class LocalBinder extends Binder {
        SignalRForegroundService getService() {
            return SignalRForegroundService.this;
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return binder;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "onCreate() - Service created");
        }
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "onStartCommand");
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "onStartCommand() - flags: " + flags + ", startId: " + startId);
        }

        if (intent != null) {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "onStartCommand() - Processing intent with extras");
            }
            hubUrl = intent.getStringExtra(INTENT_EXTRA_HUB_URL);
            accessToken = intent.getStringExtra(INTENT_EXTRA_ACCESS_TOKEN);
            keepAliveMs = intent.getLongExtra(INTENT_EXTRA_KEEP_ALIVE_MS, keepAliveMs);
            serverTimeoutMs = intent.getLongExtra(INTENT_EXTRA_SERVER_TIMEOUT_MS, serverTimeoutMs);

            Log.i(TAG, "hubUrl: " + hubUrl);
            Log.i(TAG, "accessToken: " + accessToken);
            Log.i(TAG, "keepAliveMs: " + keepAliveMs);
            Log.i(TAG, "serverTimeoutMs: " + serverTimeoutMs);

            if (VERBOSE_LOGGING) {
                Log.v(TAG, "onStartCommand() - Configuration loaded from intent");
            }

            ArrayList<String> groupsList = intent.getStringArrayListExtra(INTENT_EXTRA_GROUPS);
            if (groupsList != null) {
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "onStartCommand() - Processing " + groupsList.size() + " groups");
                }
                groups.clear();
                groups.addAll(groupsList);
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "onStartCommand() - Groups loaded: " + groups.toString());
                }
            } else {
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "onStartCommand() - No groups provided");
                }
            }

            String title = intent.getStringExtra(INTENT_EXTRA_NOTIFICATION_TITLE);
            String text = intent.getStringExtra(INTENT_EXTRA_NOTIFICATION_TEXT);

            if (VERBOSE_LOGGING) {
                Log.v(TAG, "onStartCommand() - Notification title: " + title + ", text: " + text);
            }

            startInForeground(title, text);
            ensureConnectionStarted();
        } else {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "onStartCommand() - Intent is null, using existing configuration");
            } else {
                Log.w(TAG, "onStartCommand() - Intent is null");
            }
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "onDestroy() - Service destroying, stopping ping loop");
        }
        stopPingLoop();
        super.onDestroy();
    }

    private void ensureConnectionStarted() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "ensureConnectionStarted() - Checking connection state");
        }
        if (hubConnection == null || hubConnection.getConnectionState() == HubConnectionState.DISCONNECTED) {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "ensureConnectionStarted() - Connection needs to be started");
            }
            if (hubUrl == null || hubUrl.trim().isEmpty()) {
                Log.e(TAG, "Hub URL is missing. Cannot start hubConnection.");
                return;
            }
            startConnection();
        } else {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "ensureConnectionStarted() - Connection already active, state: "
                        + hubConnection.getConnectionState());
            }
        }
    }

    private void startConnection() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startConnection() - Initializing new connection");
        }
        try {
            Log.i(TAG, "Building HubConnection");

            if (VERBOSE_LOGGING) {
                Log.v(TAG, "startConnection() - Creating builder with URL: " + hubUrl);
                Log.v(TAG, "startConnection() - Server timeout: " + serverTimeoutMs + "ms");
                Log.v(TAG, "startConnection() - Keep alive: " + keepAliveMs + "ms");
                Log.v(TAG, "startConnection() - Transport: WEBSOCKETS");
            }

            HttpHubConnectionBuilder builder = HubConnectionBuilder.create(hubUrl)
                    .withServerTimeout(serverTimeoutMs)
                    .withKeepAliveInterval(keepAliveMs)
                    .withAccessTokenProvider(Single.defer(() -> Single.just(accessToken)))
                    .withTransport(TransportEnum.WEBSOCKETS);
            hubConnection = builder.build();

            if (VERBOSE_LOGGING) {
                Log.v(TAG, "startConnection() - HubConnection built successfully");
            }

            hubConnection.onClosed(error -> {
                Log.w(TAG, "onClosed: " + (error != null ? error.getMessage() : "null"));
                if (VERBOSE_LOGGING && error != null) {
                    Log.v(TAG, "onClosed() - stack: ", error);
                }
                stopPingLoop();
                scheduleReconnection();
                notifyListeners("onDisconnected", error != null ? error.getMessage() : null);
            });

            Log.i(TAG, "starting hub hubConnection");
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "startConnection() - Starting connection with 15s timeout");
            }
            startWithTimeout(15_000L);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing SignalR hubConnection", e);
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "startConnection() - Exception details: " + e.getClass().getSimpleName() + " - "
                        + e.getMessage());
            }
        }
    }

    private void startWithTimeout(long hubConnectionTimeoutMs) {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startWithTimeout() - Setting timeout of " + hubConnectionTimeoutMs + "ms");
        }
        cancelStartTimeout();
        startTimeoutFuture = scheduler.schedule(() -> {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "startWithTimeout() - Timeout callback triggered");
            }
            if (hubConnection != null && hubConnection.getConnectionState() != HubConnectionState.CONNECTED) {
                Log.e(TAG, "Connection timeout after " + hubConnectionTimeoutMs + " ms");
                if (VERBOSE_LOGGING) {
                    Log.v(TAG,
                            "startWithTimeout() - Connection state at timeout: " + hubConnection.getConnectionState());
                }
                try {
                    hubConnection.stop();
                } catch (Throwable ignored) {
                    if (VERBOSE_LOGGING) {
                        Log.v(TAG, "startWithTimeout() - Exception during stop: " + ignored.getMessage());
                    }
                }
                scheduleReconnection();
                notifyListeners("onConnectionTimeout", null);
            } else {
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "startWithTimeout() - Connection already connected, ignoring timeout");
                }
            }
        }, hubConnectionTimeoutMs, TimeUnit.MILLISECONDS);

        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startWithTimeout() - Initiating connection start");
        }
        hubConnection.start()
                .doOnError(err -> {
                    Log.e(TAG, "HubConnection start error", err);
                    if (VERBOSE_LOGGING) {
                        Log.v(TAG, "startWithTimeout() - Start error details: " + err.getClass().getSimpleName() + " - "
                                + err.getMessage());
                    }
                })
                .subscribe(
                        () -> {
                            Log.i(TAG, "HubConnection started");
                            if (VERBOSE_LOGGING) {
                                Log.v(TAG, "startWithTimeout() - Connection started successfully");
                            }
                            cancelStartTimeout();
                            reconnectAttempts = 0;
                            rejoinGroups();
                            startPingLoop();
                            notifyListeners("onConnected", null);
                        },
                        throwable -> {
                            if (VERBOSE_LOGGING) {
                                Log.v(TAG, "startWithTimeout() - Subscribe error: "
                                        + throwable.getClass().getSimpleName() + " - " + throwable.getMessage());
                            }
                            notifyListeners("onConnectionError", throwable != null ? throwable.getMessage() : null);
                            cancelStartTimeout();
                            scheduleReconnection();
                        });
    }

    private void cancelStartTimeout() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "cancelStartTimeout() - Cancelling timeout future");
        }
        if (startTimeoutFuture != null) {
            startTimeoutFuture.cancel(true);
            startTimeoutFuture = null;
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "cancelStartTimeout() - Timeout future cancelled");
            }
        } else {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "cancelStartTimeout() - No timeout future to cancel");
            }
        }
    }

    private void scheduleReconnection() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "scheduleReconnection() - Current attempts: " + reconnectAttempts + ", max: "
                    + maxReconnectAttempts);
        }
        if (reconnectAttempts >= maxReconnectAttempts) {
            Log.w(TAG, "Max reconnection attempts reached");
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "scheduleReconnection() - Max attempts reached, giving up");
            }
            return;
        }
        int attempt = ++reconnectAttempts;
        int firstAttempt = 1;
        long delay = attempt == firstAttempt ? 0L : Math.min((long) Math.pow(2, attempt - 1) * 1000L, 30_000L); // exponential backoff
        Log.i(TAG, "Scheduling reconnection attempt " + attempt + " in " + delay + " ms");
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "scheduleReconnection() - Calculated delay: " + delay + "ms for attempt " + attempt);
        }
        scheduler.schedule(this::ensureConnectionStarted, delay, TimeUnit.MILLISECONDS);
    }

    private void startInForeground(String title, String text) {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startInForeground() - Starting foreground service with notification");
        }
        // Create a PendingIntent that opens the app's launch activity
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent();
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "startInForeground() - No launch intent found, using generic intent");
            }
        }
        int flags = PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);

        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startInForeground() - PendingIntent created with flags: " + flags);
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title != null ? title : "Real-time hubConnection")
                .setContentText(text != null ? text : "Maintaining secure hubConnection")
                .setSmallIcon(getApplicationInfo().icon)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .build();

        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startInForeground() - Notification built with ID: " + NOTIFICATION_ID);
        }

        startForeground(NOTIFICATION_ID, notification);

        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startInForeground() - Service started in foreground");
        }
    }

    private void notifyListeners(String eventName, Object data) {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "notifyListeners() - Event: " + eventName + ", data: " + data);
        }
        mainHandler.post(() -> {
            System.out.println("SignalR: Notifying listeners for " + eventName + " with data: " + data);
            Set<EventListener> listeners = hubConnectionCallbacks.get(eventName);
            if (listeners != null) {
                if (VERBOSE_LOGGING) {
                    Log.v(TAG,
                            "notifyListeners() - Notifying " + listeners.size() + " listeners for event: " + eventName);
                }
                for (EventListener listener : listeners) {
                    listener.onEvent(eventName, data);
                }
            } else {
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "notifyListeners() - No listeners registered for event: " + eventName);
                }
            }
        });
    }

    public void onEvent(String eventName, EventListener callback) {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "onEvent() - Registering listener for event: " + eventName);
        }
        if (eventName == null || eventName.trim().isEmpty()) {
            throw new IllegalArgumentException("Event name must be a non-empty string");
        }
        if (callback == null) {
            throw new IllegalArgumentException("Callback must be a non-null Runnable");
        }
        hubConnectionCallbacks.computeIfAbsent(eventName,
                key -> new HashSet<>()).add(callback);

        if (VERBOSE_LOGGING) {
            int listenerCount = hubConnectionCallbacks.get(eventName).size();
            Log.v(TAG, "onEvent() - Total listeners for " + eventName + ": " + listenerCount);
        }
    }

    private void rejoinGroups() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "rejoinGroups() - Checking connection state for group rejoining");
        }
        if (hubConnection == null || hubConnection.getConnectionState() != HubConnectionState.CONNECTED) {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "rejoinGroups() - Connection not ready, skipping group rejoining");
            }
            return;
        }

        if (VERBOSE_LOGGING) {
            Log.v(TAG, "rejoinGroups() - Rejoining " + groups.size() + " groups");
        }

        for (String group : groups) {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "rejoinGroups() - Attempting to join group: " + group);
            }
            try {
                hubConnection.invoke("AddToGroup", group)
                        .doOnError(err -> {
                            Log.e(TAG, "Failed to join group " + group, err);
                            if (VERBOSE_LOGGING) {
                                Log.v(TAG, "rejoinGroups() - Group join error for " + group + ": " + err.getMessage());
                            }
                        })
                        .subscribe(
                                () -> {
                                    Log.i(TAG, "Joined group: " + group);
                                    if (VERBOSE_LOGGING) {
                                        Log.v(TAG, "rejoinGroups() - Successfully joined group: " + group);
                                    }
                                },
                                err -> {
                                    Log.e(TAG, "Join group subscribe error for " + group, err);
                                    if (VERBOSE_LOGGING) {
                                        Log.v(TAG, "rejoinGroups() - Subscribe error for " + group + ": "
                                                + err.getMessage());
                                    }
                                } // Already handled by doOnError
                        );
            } catch (Throwable t) {
                Log.e(TAG, "Join group threw for " + group, t);
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "rejoinGroups() - Exception joining group " + group + ": " + t.getClass().getSimpleName()
                            + " - " + t.getMessage());
                }
            }
        }
    }

    private void startPingLoop() {
        stopPingLoop();
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "startPingLoop() - Scheduling ping every " + PING_INTERVAL_MS + "ms");
        }
        pingFuture = scheduler.scheduleAtFixedRate(() -> {
            try {
                if (hubConnection != null && hubConnection.getConnectionState() == HubConnectionState.CONNECTED) {
                    if (VERBOSE_LOGGING) {
                        Log.v(TAG, "startPingLoop() - Invoking Ping");
                    }
                    hubConnection.invoke(HubMethods.PING.getMethod())
                            .doOnError(err -> Log.e(TAG, "Ping invoke error", err))
                            .subscribe(
                                    () -> {
                                        if (VERBOSE_LOGGING) {
                                            Log.v(TAG, "startPingLoop() - Ping success");
                                        }
                                    },
                                    err -> {
                                        // already logged in doOnError
                                    });
                } else if (VERBOSE_LOGGING) {
                    Log.v(TAG, "startPingLoop() - Skipping ping; not connected");
                }
            } catch (Throwable t) {
                Log.e(TAG, "startPingLoop() - Exception while pinging", t);
            }
        }, PING_INTERVAL_MS, PING_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    private void stopPingLoop() {
        if (pingFuture != null) {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "stopPingLoop() - Cancelling ping");
            }
            pingFuture.cancel(true);
            pingFuture = null;
        }
    }

    private void createNotificationChannel() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "createNotificationChannel() - Creating notification channel");
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Real-time Connection",
                    NotificationManager.IMPORTANCE_LOW);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "createNotificationChannel() - Notification channel created successfully");
                }
            } else {
                if (VERBOSE_LOGGING) {
                    Log.v(TAG, "createNotificationChannel() - NotificationManager is null");
                }
            }
        } else {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "createNotificationChannel() - Android version < O, skipping channel creation");
            }
        }
    }

    public static Intent buildStartIntent(Context context,
            String hubUrl,
            String accessToken,
            List<String> groups,
            long keepAliveMs,
            long serverTimeoutMs,
            String notificationTitle,
            String notificationText) {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "buildStartIntent() - Building start intent with " + (groups != null ? groups.size() : 0)
                    + " groups");
        }
        Intent i = new Intent(context, SignalRForegroundService.class);
        i.putExtra(INTENT_EXTRA_HUB_URL, hubUrl);
        i.putExtra(INTENT_EXTRA_ACCESS_TOKEN, accessToken);
        if (groups != null) {
            i.putStringArrayListExtra(INTENT_EXTRA_GROUPS, new ArrayList<>(groups));
        }
        i.putExtra(INTENT_EXTRA_KEEP_ALIVE_MS, keepAliveMs);
        i.putExtra(INTENT_EXTRA_SERVER_TIMEOUT_MS, serverTimeoutMs);
        i.putExtra(INTENT_EXTRA_NOTIFICATION_TITLE, notificationTitle);
        i.putExtra(INTENT_EXTRA_NOTIFICATION_TEXT, notificationText);

        if (VERBOSE_LOGGING) {
            Log.v(TAG, "buildStartIntent() - Intent built successfully");
        }
        return i;
    }

    public HubConnection getHubConnection() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "getHubConnection() - Returning hub connection, state: "
                    + (hubConnection != null ? hubConnection.getConnectionState() : "null"));
        }
        return hubConnection;
    }

    @Nullable
    public String getConnectionStatus() {
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "getConnectionStatus() - Getting connection status");
        }
        if (hubConnection == null) {
            if (VERBOSE_LOGGING) {
                Log.v(TAG, "getConnectionStatus() - Hub connection is null");
            }
            return null;
        }

        String status = hubConnection.getConnectionState().toString().toLowerCase();
        if (VERBOSE_LOGGING) {
            Log.v(TAG, "getConnectionStatus() - Connection status: " + status);
        }
        return status;
    }
}
