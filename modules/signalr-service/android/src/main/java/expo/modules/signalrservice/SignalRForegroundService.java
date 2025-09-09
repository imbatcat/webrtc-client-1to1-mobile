package main.java.expo.modules.signalrservice;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
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
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import io.reactivex.rxjava3.core.Single;

public class SignalRForegroundService extends Service {
    public static final String TAG = "SignalRFGS";

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

    private ScheduledFuture<?> startTimeoutFuture;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.i(TAG, "onStartCommand");

        if (intent != null) {
            hubUrl = intent.getStringExtra(INTENT_EXTRA_HUB_URL);
            accessToken = intent.getStringExtra(INTENT_EXTRA_ACCESS_TOKEN);
            keepAliveMs = intent.getLongExtra(INTENT_EXTRA_KEEP_ALIVE_MS, keepAliveMs);
            serverTimeoutMs = intent.getLongExtra(INTENT_EXTRA_SERVER_TIMEOUT_MS, serverTimeoutMs);

            ArrayList<String> groupsList = intent.getStringArrayListExtra(INTENT_EXTRA_GROUPS);
            if (groupsList != null) {
                groups.clear();
                groups.addAll(groupsList);
            }

            String title = intent.getStringExtra(INTENT_EXTRA_NOTIFICATION_TITLE);
            String text = intent.getStringExtra(INTENT_EXTRA_NOTIFICATION_TEXT);

            startInForeground(title, text);
            ensureConnectionStarted();
        }
        return START_STICKY;
    }

    private void ensureConnectionStarted() {
        if (hubConnection == null || hubConnection.getConnectionState() == HubConnectionState.DISCONNECTED) {
            if (hubUrl == null || hubUrl.trim().isEmpty()) {
                Log.e(TAG, "Hub URL is missing. Cannot start connection.");
                return;
            }
            startConnection();
        }
    }

    private void startConnection() {
        try {
            Log.i(TAG, "Building HubConnection");

            HttpHubConnectionBuilder builder = HubConnectionBuilder.create(hubUrl)
                    .withServerTimeout(serverTimeoutMs)
                    .withKeepAliveInterval(keepAliveMs)
                    .withAccessTokenProvider(Single.defer(() -> Single.just(accessToken)))
                    .withTransport(TransportEnum.WEBSOCKETS);
            hubConnection = builder.build();

            hubConnection.onClosed(error -> {
                Log.w(TAG, "onClosed: " + (error != null ? error.getMessage() : "null"));
                // Attempt reconnection with backoff unless service is stopping
                scheduleReconnection();
            });

            Log.i(TAG, "starting hub connection");
            startWithTimeout(15_000L);
        } catch (Exception e) {
            Log.e(TAG, "Error initializing SignalR connection", e);
        }
    }

    private void startWithTimeout(long connectionTimeoutMs) {
        cancelStartTimeout();
        startTimeoutFuture = scheduler.schedule(() -> {
            if (hubConnection != null && hubConnection.getConnectionState() != HubConnectionState.CONNECTED) {
                Log.e(TAG, "Connection timeout after " + connectionTimeoutMs + " ms");
                try {
                    hubConnection.stop();
                } catch (Throwable ignored) {}
                scheduleReconnection();
            }
        }, connectionTimeoutMs, TimeUnit.MILLISECONDS);

        hubConnection.start()
                .doOnError(err -> Log.e(TAG, "HubConnection start error", err))
                .subscribe(
                        () -> {
                            Log.i(TAG, "HubConnection started");
                            cancelStartTimeout();
                            reconnectAttempts = 0;
                            rejoinGroups();
                        },
                        throwable -> {
                            cancelStartTimeout();
                            scheduleReconnection();
                        }
                );
    }

    private void cancelStartTimeout() {
        if (startTimeoutFuture != null) {
            startTimeoutFuture.cancel(true);
            startTimeoutFuture = null;
        }
    }

    private void scheduleReconnection() {
        if (reconnectAttempts >= maxReconnectAttempts) {
            Log.w(TAG, "Max reconnection attempts reached");
            return;
        }
        int attempt = ++reconnectAttempts;
        int firstAttempt = 1;
        long delay = attempt == firstAttempt ? 0L : Math.min((long) Math.pow(2, attempt - 1) * 1000L, 30_000L); // exponential backoff
        Log.i(TAG, "Scheduling reconnection attempt " + attempt + " in " + delay + " ms");
        scheduler.schedule(this::ensureConnectionStarted, delay, TimeUnit.MILLISECONDS);
    }

    private void startInForeground(String title, String text) {
        // Create a PendingIntent that opens the app's launch activity
        Intent launchIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launchIntent == null) {
            launchIntent = new Intent();
        }
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                : PendingIntent.FLAG_UPDATE_CURRENT;
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title != null ? title : "Real-time connection")
                .setContentText(text != null ? text : "Maintaining secure connection")
                .setSmallIcon(getApplicationInfo().icon)
                .setOngoing(true)
                .setContentIntent(pendingIntent)
                .build();

        startForeground(NOTIFICATION_ID, notification);
    }

    private void rejoinGroups() {
        if (hubConnection == null || hubConnection.getConnectionState() != HubConnectionState.CONNECTED) {
            return;
        }
        for (String group : groups) {
            try {
                hubConnection.invoke("AddToGroup", group)
                        .doOnError(err -> Log.e(TAG, "Failed to join group " + group, err))
                        .subscribe(
                                () -> Log.i(TAG, "Joined group: " + group),
                                err -> Log.e(TAG, "Join group error for " + group, err)
                        );
            } catch (Throwable t) {
                Log.e(TAG, "Join group threw for " + group, t);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Real-time Connection",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
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
        return i;
    }
}


