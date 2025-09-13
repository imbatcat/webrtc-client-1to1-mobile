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
import SignalrServiceModule from "../modules/signalr-service/src/SignalrServiceModule";
import signalrService from "../services/signalr/service";

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
  // const { service: signalrService } = useSignalR();
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
    const initializeHandlers = async () => {
      console.log("registering signalr handlers");
      if (
        (await SignalrServiceModule.getConnectionStatus()) ===
        ConnectionStates.CONNECTED.toLocaleLowerCase()
      ) {
        console.log("onConnected");
        boundRegisterHandlers();
      } else {
        console.log("onConnected not registered");
        SignalrServiceModule.addListener("onConnected", () =>
          boundRegisterHandlers()
        );
      }
      SignalrServiceModule.addListener("onDisconnected", () =>
        boundUnregisterHandlers()
      );
    };

    initializeHandlers();

    return () => {
      console.log("unmounting webrtc context");
      SignalrServiceModule.removeListener("onConnected", () =>
        boundRegisterHandlers()
      );
      try {
        service.unregisterSignalrHandlers.bind(service); // unregister incase onDisconnected is not called
      } catch (error) {
        console.error("Error unregistering signalr handlers:", error);
      }
      SignalrServiceModule.removeListener("onDisconnected", () =>
        boundUnregisterHandlers()
      );
    };
  }, [service, boundRegisterHandlers, boundUnregisterHandlers]);

  return (
    <WebRTCContext.Provider value={useMemo(() => ({ service }), [service])}>
      {children}
    </WebRTCContext.Provider>
  );
};

export default WebRTCContext;
