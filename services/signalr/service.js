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
  #reconnectDelayInMs = 5000; 

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
        return;
      }
    } catch (error) {
      console.error("SignalR connection error:", error);
    }
  }
}

const signalrService = new SignalRService();
export default signalrService;
