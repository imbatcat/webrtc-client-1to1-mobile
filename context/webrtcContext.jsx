import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useSignalR } from "./signalrContext";
import WebRTCService from "../services/webrtc/service";
import { ConnectionStates } from "../services/signalr/ConnectionStates";
import { requireNativeModule } from "expo";

// Create the context
const WebRTCContext = createContext();

// Custom hook to use the WebRTC context
export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error("useWebRTC must be used within a WebRTCProvider");
  }
  return context;
};

export const WebRTCProvider = ({ children }) => {
  const SignalrEventSub = requireNativeModule("SignalrService");
  const service = useMemo(() => new WebRTCService(), []);

  const boundRegisterHandlers = useMemo(
    () => service.registerSignalrHandlers.bind(service),
    [service]
  );
  const boundUnregisterHandlers = useMemo(
    () => service.unregisterSignalrHandlers.bind(service),
    [service]
  );

  useEffect(() => {
    let connectedSub;
    let disconnectedSub;

    const initializeHandlers = async () => {
      console.log("registering signalr handlers");
      if (
        (await SignalrEventSub.getConnectionStatus()) ===
        ConnectionStates.CONNECTED.toLocaleLowerCase()
      ) {
        console.log("onConnected");
        boundRegisterHandlers();
      } else {
        console.log("onConnected not registered");
        connectedSub = SignalrEventSub.addListener("onConnected", () =>
          boundRegisterHandlers()
        );
      }
      disconnectedSub = SignalrEventSub.addListener("onDisconnected", () =>
        boundUnregisterHandlers()
      );
    };

    initializeHandlers();

    return () => {
      console.log("unmounting webrtc context");
      try {
        connectedSub?.remove?.();
        disconnectedSub?.remove?.();
      } catch {}
      try {
        service.unregisterSignalrHandlers();
      } catch (error) {
        console.error("Error unregistering signalr handlers:", error);
      }
    };
  }, [service, boundRegisterHandlers, boundUnregisterHandlers]);

  return (
    <WebRTCContext.Provider value={useMemo(() => ({ service }), [service])}>
      {children}
    </WebRTCContext.Provider>
  );
};

export default WebRTCContext;
