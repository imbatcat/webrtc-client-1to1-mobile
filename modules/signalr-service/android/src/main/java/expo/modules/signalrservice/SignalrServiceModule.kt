package expo.modules.signalrservice

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.Build
import android.os.IBinder
import android.os.Bundle
import android.util.Log
import androidx.core.os.bundleOf
import expo.modules.kotlin.Promise
import expo.modules.kotlin.events.EventEmitter
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.signalrservice.SignalRForegroundService.EventListener


class SignalrServiceModule : Module() {
  private var boundSignalRService: SignalRForegroundService? = null
  private val VERBOSE_LOGGING = true // Set to false in production
  override fun definition() = ModuleDefinition {
    Name("SignalrService")

    Events("UserLeft", "ReceiveMessage", "ReceiveICECandidate",
            "onConnected", "onDisconnected", "onReconnecting", "UserJoined")

    AsyncFunction("invoke") { method: String, args: List<Any>, promise: Promise ->
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "invoke() - Method: $method, args count: ${args.size}")
      }
      val hubConnection = boundSignalRService?.hubConnection
      if (hubConnection == null) {
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "invoke() - Service not bound, rejecting promise")
        }
        promise.reject(
          "SERVICE_NOT_BOUND",
          "SignalR service is not bound",
          Error("Service not bound")
        )
        return@AsyncFunction
      }
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "invoke() - Invoking method on hub connection")
      }
      hubConnection.invoke(Object::class.java, method, *args.toTypedArray()).subscribe({ result ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "invoke() - Method invoked successfully")
        }
        promise.resolve(result)
      }, { error ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "invoke() - Method invoke failed: ${error.message}")
        }
        promise.reject("INVOKE_FAILED", error.message, error)
      })
    }

    AsyncFunction("send") { method: String, args: List<Any>, promise: Promise ->
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "send() - Method: $method, args count: ${args.size}")
      }
      val hubConnection = boundSignalRService?.hubConnection
      if (hubConnection == null) {
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "send() - Service not bound, cannot send")
        }
        return@AsyncFunction
      }
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "send() - Sending method on hub connection")
      }
      hubConnection.send(method, *args.toTypedArray())
    }

    AsyncFunction("onEvent") { eventName: String ->
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "onEvent() - Registering listener for event: $eventName")
      }
      val listener = object : EventListener {
        override fun onEvent(eventType: String, payload: Any?) {
          if (VERBOSE_LOGGING) {
            Log.v("SignalrServiceModule", "onEvent() - Event received: $eventType, payload class: ${payload?.javaClass?.name ?: "null"}")
          }
          val params = normalizeEventParams(payload)
          this@SignalrServiceModule.sendEvent(eventType, params)
        }
      }
      boundSignalRService?.onEvent(eventName, listener)
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "onEvent() - Listener registered for event: $eventName")
      }
    }

    AsyncFunction("registerHandlers") {
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "registerHandlers() - Registering SignalR handlers")
      }
      registerHandlers()
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "registerHandlers() - Handlers registered successfully")
      }
    }

    AsyncFunction("unregisterHandlers") {
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "unregisterHandlers() - Unregistering SignalR handlers")
      }
      unregisterHandlers()
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "unregisterHandlers() - Handlers unregistered successfully")
      }
    }

    AsyncFunction("startService") { config: Map<String, Any?> ->
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "startService() - Starting SignalR service")
      }
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      val hubUrl = config["hubUrl"] as? String
      val accessToken = config["accessToken"] as? String
      val groups = (config["groups"] as? List<*>)?.mapNotNull { it as? String } ?: emptyList()
      val keepAliveMs = (config["keepAliveMs"] as? Number)?.toLong() ?: 30_000L
      val serverTimeoutMs = (config["serverTimeoutMs"] as? Number)?.toLong() ?: 60_000L
      val notificationTitle = config["notificationTitle"] as? String ?: "Real-time connection"
      val notificationText =
        config["notificationText"] as? String ?: "Maintaining secure connection"
      
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "startService() - Configuration: hubUrl=$hubUrl, groups=${groups.size}, keepAlive=$keepAliveMs, timeout=$serverTimeoutMs")
      }
      
      Log.d("SignalRFGS", "Starting service with hubUrl: $hubUrl")
      Log.d("SignalRFGS", "Access token: ${if (accessToken != null) "[TOKEN_PROVIDED]" else "[NO_TOKEN]"}")

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
      
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "startService() - Intent created, starting service")
      }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "startService() - Starting foreground service (Android O+)")
        }
        context.startForegroundService(intent)
      } else {
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "startService() - Starting regular service (Android < O)")
        }
        context.startService(intent)
      }

      val serviceConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
          if (VERBOSE_LOGGING) {
            Log.v("SignalrServiceModule", "startService() - Service connected, binding to service")
          }
          val localBinder = binder as SignalRForegroundService.LocalBinder
          val service = localBinder.getService()
          boundSignalRService = service
          boundSignalRService?.onEvent("onConnected", object : EventListener {
            override fun onEvent(eventType: String, payload: Any?) {
              if (VERBOSE_LOGGING) {
                Log.v("SignalrServiceModule", "startService() - onConnected event received")
              }
              this@SignalrServiceModule.sendEvent("onConnected", null)
            }
          })
          boundSignalRService?.onEvent("onDisconnected", object : EventListener {
            override fun onEvent(eventType: String, payload: Any?) {
              if (VERBOSE_LOGGING) {
                Log.v("SignalrServiceModule", "startService() - onDisconnected event received")
              }
              this@SignalrServiceModule.sendEvent("onDisconnected", null)
            }
          })
          if (VERBOSE_LOGGING) {
            Log.v("SignalrServiceModule", "startService() - Event listeners registered")
          }
        }

        override fun onServiceDisconnected(name: ComponentName) {
          if (VERBOSE_LOGGING) {
            Log.v("SignalrServiceModule", "startService() - Service disconnected")
          }
          boundSignalRService = null
          // Optionally notify JS or UI that service is disconnected
        }
      }
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "startService() - Binding to service")
      }
      context.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE)

    }

    AsyncFunction("stopService") {
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "stopService() - Stopping SignalR service")
      }
      val context = appContext.reactContext ?: throw IllegalStateException("No React context")
      // Unbind service if bound
      val intent = Intent(context, SignalRForegroundService::class.java)
      context.stopService(intent)
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "stopService() - Service stop requested")
      }
    }

    AsyncFunction("getConnectionStatus") {
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "getConnectionStatus() - Getting connection status")
      }
      val status = boundSignalRService?.getConnectionStatus() ?: "NOT_BOUND"
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "getConnectionStatus() - Status: $status")
      }
      status
    }


  }

  private fun registerHandlers() {
    if (VERBOSE_LOGGING) {
      Log.v("SignalrServiceModule", "registerHandlers() - Registering individual handlers")
    }
    if (boundSignalRService == null) {
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "registerHandlers() - boundSignalRService is null, cannot register handlers")
      }
      return
    }
    
    if (boundSignalRService?.hubConnection == null) {
      if (VERBOSE_LOGGING) {
        Log.v("SignalrServiceModule", "registerHandlers() - hubConnection is null, cannot register handlers")
      }
      return
    }
    boundSignalRService?.hubConnection?.on(
      "ReceiveMessage",
      { message: String ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "registerHandlers() - RECEIVE_MESSAGE handler triggered: $message")
        }
        this@SignalrServiceModule.sendEvent(
          ClientMethods.RECEIVE_MESSAGE.getMethod(),
          bundleOf("message" to message)
        )
      },
      String::class.java
    )

    boundSignalRService?.hubConnection?.on(
      ClientMethods.RECEIVE_ICE_CANDIDATE.getMethod(),
      { candidate: String ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "registerHandlers() - RECEIVE_ICE_CANDIDATE handler triggered: $candidate")
        }
        this@SignalrServiceModule.sendEvent(
          ClientMethods.RECEIVE_ICE_CANDIDATE.getMethod(),
          bundleOf("candidate" to candidate)
        )
      },
      String::class.java
    )

    boundSignalRService?.hubConnection?.on(
      ClientMethods.USER_LEFT.getMethod(),
      { username: String ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "registerHandlers() - USER_LEFT handler triggered: $username")
        }
        this@SignalrServiceModule.sendEvent(
          ClientMethods.USER_LEFT.getMethod(),
          bundleOf("username" to username)
        )
      },
      String::class.java
    )

    boundSignalRService?.hubConnection?.on(
      ClientMethods.USER_JOINED.getMethod(),
      { username: String ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "registerHandlers() - USER_JOINED handler triggered: $username")
        }
        this@SignalrServiceModule.sendEvent(
          ClientMethods.USER_JOINED.getMethod(),
          bundleOf("username" to username)
        )
      },
      String::class.java
    )

    boundSignalRService?.hubConnection?.on(
      ClientMethods.ROOM_DOES_NOT_EXIST.getMethod(),
      { roomId: String ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "registerHandlers() - ROOM_DOES_NOT_EXIST handler triggered: $roomId")
        }
        this@SignalrServiceModule.sendEvent(
          ClientMethods.ROOM_DOES_NOT_EXIST.getMethod(),
          bundleOf("roomId" to roomId)
        )
      },
      String::class.java
    )
    boundSignalRService?.hubConnection?.on(
      ClientMethods.NOT_AUTHORIZED_TO_JOIN.getMethod(),
      { roomId: String ->
        if (VERBOSE_LOGGING) {
          Log.v("SignalrServiceModule", "registerHandlers() - NOT_AUTHORIZED_TO_JOIN handler triggered: $roomId")
        }
        this@SignalrServiceModule.sendEvent(
          ClientMethods.NOT_AUTHORIZED_TO_JOIN.getMethod(), bundleOf("roomId" to roomId)
        )
      },
      String::class.java
    )
  }

  private fun unregisterHandlers() {
    if (VERBOSE_LOGGING) {
      Log.v("SignalrServiceModule", "unregisterHandlers() - Unregistering individual handlers")
    }
    boundSignalRService?.hubConnection?.remove(ClientMethods.RECEIVE_MESSAGE.getMethod())
    boundSignalRService?.hubConnection?.remove(ClientMethods.RECEIVE_ICE_CANDIDATE.getMethod())
    boundSignalRService?.hubConnection?.remove(ClientMethods.USER_LEFT.getMethod())
    boundSignalRService?.hubConnection?.remove(ClientMethods.USER_JOINED.getMethod())
    boundSignalRService?.hubConnection?.remove(ClientMethods.ROOM_DOES_NOT_EXIST.getMethod())
    boundSignalRService?.hubConnection?.remove(ClientMethods.NOT_AUTHORIZED_TO_JOIN.getMethod())
    if (VERBOSE_LOGGING) {
      Log.v("SignalrServiceModule", "unregisterHandlers() - All handlers unregistered")
    }
  }

  private fun normalizeEventParams(payload: Any?): Bundle? {
    if (payload == null) return null
    return when (payload) {
      is Map<*, *> -> buildBundleFromMap(payload)
      is Collection<*> -> Bundle().apply {
        putStringArrayList("data", ArrayList(payload.map { it?.toString() ?: "" }))
      }
      is String -> bundleOf("data" to payload)
      is Int -> bundleOf("data" to payload)
      is Long -> bundleOf("data" to payload)
      is Double -> bundleOf("data" to payload)
      is Float -> bundleOf("data" to payload)
      is Boolean -> bundleOf("data" to payload)
      else -> bundleOf("data" to payload.toString())
    }
  }

  private fun buildBundleFromMap(map: Map<*, *>): Bundle {
    val bundle = Bundle()
    for ((k, v) in map) {
      val key = k?.toString() ?: continue
      putSupported(bundle, key, v)
    }
    return bundle
  }

  private fun putSupported(bundle: Bundle, key: String, value: Any?) {
    when (value) {
      null -> { /* skip nulls */ }
      is String -> bundle.putString(key, value)
      is Boolean -> bundle.putBoolean(key, value)
      is Int -> bundle.putInt(key, value)
      is Long -> bundle.putLong(key, value)
      is Double -> bundle.putDouble(key, value)
      is Float -> bundle.putFloat(key, value)
      is Map<*, *> -> bundle.putBundle(key, buildBundleFromMap(value))
      is Collection<*> -> bundle.putStringArrayList(key, ArrayList(value.map { it?.toString() ?: "" }))
      else -> bundle.putString(key, value.toString())
    }
  }
}
