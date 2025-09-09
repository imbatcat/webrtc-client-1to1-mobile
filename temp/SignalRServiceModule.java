package com.oranged_cat.webrtcclient1to1mobile;

import android.content.Intent;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;

import java.util.ArrayList;

public class SignalRServiceModule extends ReactContextBaseJavaModule {

    public SignalRServiceModule(@Nullable ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "SignalRService";
    }

    @ReactMethod
    public void startService(ReadableMap config, Promise promise) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            String hubUrl = config.hasKey("hubUrl") ? config.getString("hubUrl") : null;
            String accessToken = config.hasKey("accessToken") ? config.getString("accessToken") : null;
            long keepAliveMs = config.hasKey("keepAliveMs") ? (long) config.getDouble("keepAliveMs") : 30000L;
            long serverTimeoutMs = config.hasKey("serverTimeoutMs") ? (long) config.getDouble("serverTimeoutMs") : 60000L;
            String title = config.hasKey("notificationTitle") ? config.getString("notificationTitle") : "Real-time connection";
            String text = config.hasKey("notificationText") ? config.getString("notificationText") : "Maintaining secure connection";

            ArrayList<String> groups = new ArrayList<>();
            if (config.hasKey("groups")) {
                ReadableArray arr = config.getArray("groups");
                if (arr != null) {
                    for (int i = 0; i < arr.size(); i++) {
                        if (!arr.isNull(i)) groups.add(arr.getString(i));
                    }
                }
            }

            Intent intent = SignalRForegroundService.buildStartIntent(
                ctx,
                hubUrl,
                accessToken,
                groups,
                keepAliveMs,
                serverTimeoutMs,
                title,
                text
            );

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }

            promise.resolve(true);
        } catch (Throwable t) {
            promise.reject("Error starting signalr service", t);
        }
    }

    @ReactMethod
    public void stopService(Promise promise) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            Intent intent = new Intent(ctx, SignalRForegroundService.class);
            boolean stopped = ctx.stopService(intent);
            promise.resolve(stopped);
        } catch (Throwable t) {
            promise.reject("Error stopping signalr service", t);
        }
    }
}
