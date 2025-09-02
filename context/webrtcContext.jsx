import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useSignalR } from "./signalrContext";
import WebRTCService from "../services/webrtc/service";
import { useLocalSearchParams } from "expo-router";

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
  const { username } = useLocalSearchParams();
  const { service: signalrService } = useSignalR();
  const service = useMemo(() => new WebRTCService(username), [username]);

  // Create bound methods that maintain proper 'this' context for private fields
  const boundRegisterHandlers = useMemo(
    () => service.registerSignalrHandlers.bind(service),
    [service]
  );
  const boundUnregisterHandlers = useMemo(
    () => service.unregisterSignalrHandlers.bind(service),
    [service]
  );

  useEffect(() => {
    signalrService.onEvent("onConnected", boundRegisterHandlers);
    signalrService.onEvent("onDisconnected", boundUnregisterHandlers);

    return () => {
      signalrService.offEvent("onConnected", boundRegisterHandlers);
      try {
        service.unregisterSignalrHandlers();
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
