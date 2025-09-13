import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { Platform, NativeModules } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as signalR from "@microsoft/signalr";
import SignalrServiceModule from "../../modules/signalr-service/src/SignalrServiceModule";

class SignalRService {
  #connection = null;
  #connectionCallbacks = new Map(); // eventName -> callback : Map<string, Set<function>>
  #groups = [];
  #reconnectAttempts = 0;
  #maxReconnectAttempts = 5;
  #reconnectDelay = 5000; // 5 seconds

  // Public getters
  get connection() {
    return this.#connection;
  }
  get connectionStatus() {
    const state =
      this.#connection?.state ?? signalR.HubConnectionState.Disconnected;
    return {
      state, // Connected | Connecting | Reconnecting | Disconnected
      connectionId: this.#connection?.connectionId ?? null,
    };
  }

  async startConnection() {
    try {
      if (
        Platform.OS === "android" &&
        process.env.EXPO_PUBLIC_SIGNALR_NATIVE === "1"
      ) {
        console.log("Starting SignalR connection in foreground service");
        const hubUrl = process.env.EXPO_PUBLIC_HUB_URL;
        const accessToken = await AsyncStorage.getItem("accessToken");
        const serverTimeoutMs = parseInt(
          process.env.EXPO_PUBLIC_SIGNALR_SERVER_TIMEOUT_MS ?? "600000",
          10
        );
        const keepAliveMs = parseInt(
          process.env.EXPO_PUBLIC_SIGNALR_KEEPALIVE_MS ?? "300000",
          10
        );
        const groups = this.#groups;
        SignalrServiceModule.startService({
          hubUrl: hubUrl,
          accessToken: accessToken,
          groups: groups,
          keepAliveMs: keepAliveMs,
          serverTimeoutMs: serverTimeoutMs,
          notificationTitle: "Connecting…",
          notificationText: "Maintaining real-time connection",
        });
        // this.#connection = { state: signalR.HubConnectionState.Connected }; // TODO: wtf
        // this.triggerCallback("onConnected");
        // this.#setupLifeCycleHandlers();
        return;
      }

      const hubUrl = process.env.EXPO_PUBLIC_HUB_URL;
      console.log("hubUrl", hubUrl);
      if (!hubUrl) {
        throw new Error("HUB_URL not found in environment variables");
      }

      const accessToken = await AsyncStorage.getItem("accessToken");
      console.log("accessToken", accessToken);

      const serverTimeoutMs = parseInt(
        process.env.EXPO_PUBLIC_SIGNALR_SERVER_TIMEOUT_MS ?? "60000",
        10
      );
      const keepAliveMs = parseInt(
        process.env.EXPO_PUBLIC_SIGNALR_KEEPALIVE_MS ?? "30000",
        10
      );

      // Build connection with authentication
      this.#connection = new HubConnectionBuilder()
        .withUrl(hubUrl, {
          accessTokenFactory: () => accessToken,
          skipNegotiation: true,
          transport: signalR.HttpTransportType.WebSockets,
        })
        .withServerTimeout(serverTimeoutMs)
        .withKeepAliveInterval(keepAliveMs)
        .withAutomaticReconnect({
          nextRetryDelayInMilliseconds: (retryContext) => {
            if (retryContext.previousRetryCount === 0) {
              return 0;
            }
            return Math.min(
              1000 * Math.pow(2, retryContext.previousRetryCount),
              30000
            );
          },
        })
        .build();

      // add a timeout to wait connection to start, with 15s timeout
      await Promise.race([
        this.#connection.start(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Connection timeout after 15 seconds")),
            15000
          )
        ),
      ]);
      this.triggerCallback("onConnected");
      this.#setupLifeCycleHandlers();
    } catch (error) {
      console.error("SignalR: Initial connection failed", error);
      this.triggerCallback("onInitialConnectionFailed", error);

      await this.handleReconnection();
    }
  }

  async addToGroup(groupName) {
    if (this.#connection.state !== signalR.HubConnectionState.Connected) {
      console.warn("SignalR: Cannot join group - not connected");
      return false;
    }

    try {
      await this.#connection.invoke("AddToGroup", groupName);
      console.log(`SignalR: Successfully joined group: ${groupName}`);
      if (!this.#groups.includes(groupName)) {
        this.#groups.push(groupName);
      }
      return true;
    } catch (error) {
      console.error(`SignalR: Failed to join group ${groupName}:`, error);
      return false;
    }
  }

  async removeFromGroup(groupName) {
    if (this.#connection.state !== signalR.HubConnectionState.Connected) {
      console.warn("SignalR: Cannot leave group - not connected");
      return false;
    }

    try {
      await this.#connection.invoke("RemoveFromGroup", groupName);
      console.log(`SignalR: Successfully left group: ${groupName}`);
      this.#groups = this.#groups.filter((group) => group !== groupName);
      return true;
    } catch (error) {
      console.error(`SignalR: Failed to leave group ${groupName}:`, error);
      return false;
    }
  }

  async handleReconnection() {
    if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
      console.log("SignalR: Max reconnection attempts reached");
      this.triggerCallback("onMaxReconnectAttemptsReached");
      return;
    }

    this.#reconnectAttempts++;
    console.log(
      `SignalR: Reconnection attempt ${this.#reconnectAttempts}/${
        this.#maxReconnectAttempts
      }`
    );

    setTimeout(async () => {
      console.log("SignalR: Reconnection attempt", this.#connection.state);
      if (this.#connection.state !== signalR.HubConnectionState.Connected) {
        await this.startConnection();
      }
    }, this.#reconnectDelay);
  }

  async stopConnection() {
    if (
      Platform.OS === "android" &&
      process.env.EXPO_PUBLIC_SIGNALR_NATIVE === "1"
    ) {
      try {
        await SignalrServiceModule.stopService();
      } catch (e) {
        console.error("SignalR: Error stopping native service", e);
      } finally {
        this.#connectionCallbacks.clear();
      }
      return;
    }
    if (this.#connection) {
      try {
        await this.#connection.stop();
        this.#removeLifeCycleHandlers();
        console.log("SignalR: Connection stopped");
      } catch (error) {
        console.error("SignalR: Error stopping connection", error);
      } finally {
        this.#connectionCallbacks.clear();
      }
    }
  }

  onEvent(eventName, callback) {
    if (typeof eventName !== "string" || !eventName.trim()) {
      throw new Error("Event name must be a non-empty string");
    }
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function");
    }

    if (!this.#connectionCallbacks.has(eventName)) {
      this.#connectionCallbacks.set(eventName, new Set());
    }
    this.#connectionCallbacks.get(eventName).add(callback);
  }

  offEvent(eventName, callback) {
    if (typeof eventName !== "string" || !eventName.trim()) {
      throw new Error("Event name must be a non-empty string");
    }
    if (typeof callback !== "function") {
      throw new Error("Callback must be a function");
    }
    if (this.#connectionCallbacks.has(eventName)) {
      const callbacksSet = this.#connectionCallbacks.get(eventName);
      if (callbacksSet) {
        callbacksSet.delete(callback);
        if (callbacksSet.size === 0) {
          this.#connectionCallbacks.delete(eventName);
        }
      }
    }
  }

  // trigger callback once and then remove it
  once(eventName, callback) {
    const wrappedCallback = () => {
      try {
        callback();
      } catch (error) {
        console.error(`SignalR: Error in ${eventName} callback:`, error);
      } finally {
        // remove callback after it is triggered
        this.offEvent(eventName, wrappedCallback);
      }
    };
    this.onEvent(eventName, wrappedCallback);
  }

  triggerCallback(eventName, data = null) {
    console.log("SignalR: Triggering callback", eventName, data);
    if (this.#connectionCallbacks.has(eventName)) {
      this.#connectionCallbacks.get(eventName).forEach((callback) => {
        try {
          if (!callback) return;
          callback(data);
        } catch (error) {
          console.error(`SignalR: Error in ${eventName} callback:`, error);
        }
      });
    }
  }

  // getConnectionStatus() {
  //   return {
  //     isConnected:
  //       this.#connection.state === signalR.HubConnectionState.Connected,
  //     isConnecting:
  //       this.#connection.state === signalR.HubConnectionState.Connecting,
  //     reconnectAttempts: this.#reconnectAttempts,
  //     connectionId: this.#connection?.connectionId || null,
  //   };
  // }

  #setupLifeCycleHandlers() {
    console.log("SignalR: Setting up life cycle handlers");
    this.#connection.onclose = async (error) => {
      console.log("SignalR: Connection closed", error);
      this.triggerCallback("onDisconnected", error);

      // Attempt reconnection if not manually closed
      if (error) {
        await this.handleReconnection();
      }
    };

    this.#connection.onreconnecting = (error) => {
      console.log("SignalR: Reconnecting...", error);
      this.triggerCallback("onReconnecting", error);
    };

    this.#connection.onreconnected = (connectionId) => {
      this.#reconnectAttempts = 0;
      console.log("SignalR: Reconnected", connectionId);
      // rejoin groups since signalr loses them on reconnect
      this.#groups.forEach((group) => {
        this.addToGroup(group);
      });
      this.triggerCallback("onReconnected", connectionId);
    };
  }

  #removeLifeCycleHandlers() {
    this.#connection.onclose = null;
    this.#connection.onreconnecting = null;
    this.#connection.onreconnected = null;
  }

  invokeHubMethod(methodName, ...args) {
    console.log("InvokeHubMethod", methodName, args);
    if (!this.#connection) {
      return Promise.reject(new Error("Hub connection is not initialized."));
    }

    if (this.#connection.state !== signalR.HubConnectionState.Connected) {
      return Promise.reject(
        new Error(
          `Hub connection is not connected. Current state: ${
            this.#connection.state
          }`
        )
      );
    }

    return this.#connection.invoke(methodName, ...args);
  }

  sendHubMethod(methodName, ...args) {
    console.log("SendHubMethod", methodName, args);
    if (!this.#connection) {
      return Promise.reject(new Error("Hub connection is not initialized."));
    }

    if (this.#connection.state !== signalR.HubConnectionState.Connected) {
      return Promise.reject(
        new Error(
          `Hub connection is not connected. Current state: ${
            this.#connection.state
          }`
        )
      );
    }

    return this.#connection.send(methodName, ...args);
  }

  get boundTriggerCallback() {
    return this.triggerCallback.bind(this);
  }
}

const signalrService = new SignalRService();
export default signalrService;
