package expo.modules.signalrservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SignalrServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SignalrService")

    AsyncFunction("startService") { config: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      val hubUrl = config["hubUrl"] as? String
      val accessToken = config["accessToken"] as? String
      val groups = (config["groups"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
      val keepAliveMs = (config["keepAliveMs"] as? Number)?.toLong() ?: 30_000L
      val serverTimeoutMs = (config["serverTimeoutMs"] as? Number)?.toLong() ?: 60_000L
      val notificationTitle = config["notificationTitle"] as? String ?: "Real-time connection"
      val notificationText = config["notificationText"] as? String ?: "Maintaining secure connection"

      val intent = SignalRForegroundService.buildStartIntent(
        context,
        hubUrl,
        accessToken,
        groups,
        keepAliveMs,
        serverTimeoutMs,
        notificationTitle,
        notificationText
      )

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }

      true
    }

    AsyncFunction("stopService") {
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      val intent = Intent(context, SignalRForegroundService::class.java)
      context.stopService(intent)
    }
  }
}
