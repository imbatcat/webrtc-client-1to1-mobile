package expo.modules.signalrservice

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import androidx.core.os.bundleOf
import expo.modules.kotlin.Promise
import expo.modules.kotlin.events.EventEmitter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.signalrservice.SignalRForegroundService.EventListener


class SignalrServiceModule : Module() {
  private var boundSignalRService: SignalRForegroundService? = null
  override fun definition() = ModuleDefinition {
    Name("SignalrService")

    Events("UserLeft", "ReceiveMessage", "ReceiveIceCandidate",
            "onConnected", "onDisconnected", "onReconnecting")

    AsyncFunction("invoke") { method: String, args: List<Any>, promise: Promise ->
      val hubConnection = boundSignalRService?.hubConnection
      if (hubConnection == null) {
        promise.reject(
          "SERVICE_NOT_BOUND",
          "SignalR service is not bound",
          Error("Service not bound")
        )
        return@AsyncFunction
      }
      hubConnection.invoke(Object::class.java, method, *args.toTypedArray()).subscribe({ result ->
        promise.resolve(result)
      }, { error ->
        promise.reject("INVOKE_FAILED", error.message, error)
      })
    }

    AsyncFunction("send") { method: String, args: List<Any>, promise: Promise ->
      boundSignalRService?.hubConnection?.send(method, *args.toTypedArray())
    }

    AsyncFunction("onEvent") { eventName: String ->
      val listener = object : EventListener {
        override fun onEvent(eventType: String, payload: Any) {
          this@SignalrServiceModule.sendEvent(eventType, bundleOf("data" to payload))
        }
      }
      boundSignalRService?.onEvent(eventName, listener)
    }

    AsyncFunction("registerHandlers") {
      registerHandlers()
    }

    AsyncFunction("unregisterHandlers") {
      unregisterHandlers()
    }

    AsyncFunction("startService") { config: Map<String, Any?> ->
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      val hubUrl = config["hubUrl"] as? String
      val accessToken = config["accessToken"] as? String
      val groups = (config["groups"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
      val keepAliveMs = (config["keepAliveMs"] as? Number)?.toLong() ?: 30_000L
      val serverTimeoutMs = (config["serverTimeoutMs"] as? Number)?.toLong() ?: 60_000L
      val notificationTitle = config["notificationTitle"] as? String ?: "Real-time connection"
      val notificationText =
        config["notificationText"] as? String ?: "Maintaining secure connection"

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
        context.startService(intent,)
      }

      val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
          val localBinder = binder as SignalRForegroundService.LocalBinder
          val service = localBinder.getService()
          boundSignalRService = service
          boundSignalRService?.onEvent("onConnected", object : EventListener {
            override fun onEvent(eventType: String, payload: Any?) {
              this@SignalrServiceModule.sendEvent("onConnected", null)
            }
          })
          boundSignalRService?.onEvent("onDisconnected", object : EventListener {
            override fun onEvent(eventType: String, payload: Any?) {
              this@SignalrServiceModule.sendEvent("onDisconnected", null)
            }
          })
        }

        override fun onServiceDisconnected(name: ComponentName) {
          boundSignalRService = null
          // Optionally notify JS or UI that service is disconnected
        }
      }
      context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)

    }

    AsyncFunction("stopService") {
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      // Unbind service if bound
      val intent = Intent(context, SignalRForegroundService::class.java)
      context.stopService(intent)
    }

    AsyncFunction("getConnectionStatus") {
      val status = boundSignalRService?.getConnectionStatus() ?: "NOT_BOUND"
      status
    }


  }

  private fun registerHandlers() {
    boundSignalRService?.hubConnection?.on(
      ClientMethods.RECEIVE_MESSAGE.method,
      { message: String ->
        this@SignalrServiceModule.sendEvent(
          ClientMethods.RECEIVE_MESSAGE.method,
          bundleOf("message" to message)
        )
      },
      String::class.java
    )

    boundSignalRService?.hubConnection?.on(
      ClientMethods.RECEIVE_ICE_CANDIDATE.method,
      { candidate: String ->
        this@SignalrServiceModule.sendEvent(
          ClientMethods.RECEIVE_ICE_CANDIDATE.method,
          bundleOf("candidate" to candidate)
        )
      },
      String::class.java
    )

    boundSignalRService?.hubConnection?.on(
      ClientMethods.USER_LEFT.method,
      { username: String ->
        this@SignalrServiceModule.sendEvent(
          ClientMethods.USER_LEFT.method,
          bundleOf("username" to username)
        )
      },
      String::class.java
    )

    boundSignalRService?.hubConnection?.on(
      ClientMethods.ROOM_DOES_NOT_EXIST.method,
      { roomId: String ->
        this@SignalrServiceModule.sendEvent(
          ClientMethods.ROOM_DOES_NOT_EXIST.method,
          bundleOf("roomId" to roomId)
        )
      },
      String::class.java
    )
    boundSignalRService?.hubConnection?.on(
      ClientMethods.NOT_AUTHORIZED_TO_JOIN.method,
      { roomId: String ->
        this@SignalrServiceModule.sendEvent(
          ClientMethods.NOT_AUTHORIZED_TO_JOIN.method, bundleOf("roomId" to roomId)
        )
      },
      String::class.java
    )
  }

  private fun unregisterHandlers() {
    boundSignalRService?.hubConnection?.remove(ClientMethods.RECEIVE_MESSAGE.method)
    boundSignalRService?.hubConnection?.remove(ClientMethods.RECEIVE_ICE_CANDIDATE.method)
    boundSignalRService?.hubConnection?.remove(ClientMethods.USER_LEFT.method)
    boundSignalRService?.hubConnection?.remove(ClientMethods.ROOM_DOES_NOT_EXIST.method)
    boundSignalRService?.hubConnection?.remove(ClientMethods.NOT_AUTHORIZED_TO_JOIN.method)
  }
}
