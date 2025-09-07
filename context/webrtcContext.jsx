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

const WebRTCContext = createContext();

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error("useWebRTC must be used within a WebRTCProvider");
  }
  return context;
};

export const WebRTCProvider = ({ children }) => {
  const service = useMemo(() => new WebRTCService(), []);
  const { service: signalrService } = useSignalR();

  const boundRegisterHandlers = useMemo(
    () => service.registerSignalrHandlers.bind(service),
    [service]
  );
  const boundUnregisterHandlers = useMemo(
    () => service.unregisterSignalrHandlers.bind(service),
    [service]
  );

  useEffect(() => {
    if (signalrService.connectionStatus.state === ConnectionStates.CONNECTED) {
      boundRegisterHandlers();
    } else {
      signalrService.onEvent("onConnected", boundRegisterHandlers);
    }
    signalrService.onEvent("onDisconnected", boundUnregisterHandlers);

    return () => {
      signalrService.offEvent("onConnected", boundRegisterHandlers);
      try {
        service.unregisterSignalrHandlers(); // unregister incase onDisconnected is not called
      } catch (error) {
        console.error("Error unregistering signalr handlers:", error);
      }
      signalrService.offEvent("onDisconnected", boundUnregisterHandlers);
    };
  }, [service, boundRegisterHandlers, boundUnregisterHandlers]);

  return (
    <WebRTCContext.Provider value={useMemo(() => ({ service }), [service])}>
      {children}
    </WebRTCContext.Provider>
  );
};

export default WebRTCContext;
