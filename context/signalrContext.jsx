import React, { createContext, useContext, useEffect, useMemo } from "react";
import signalrService from "../services/signalr/service";

// Create the context
const SignalRContext = createContext();

// Custom hook to use the SignalR context
export const useSignalR = () => {
  const context = useContext(SignalRContext);
  if (!context) {
    throw new Error("useSignalR must be used within a SignalRProvider");
  }
  return context;
};

// Provider component
export const SignalRProvider = ({ children }) => {
  const service = useMemo(() => signalrService, []);

  useEffect(() => {
    (async () => {
      await service.startConnection();
    })();

    return () => {
      console.log("unmounting signalr context");
      service.stopConnection();
    };
  }, []);

  return (
    <SignalRContext.Provider value={useMemo(() => ({ service }), [service])}>
      {children}
    </SignalRContext.Provider>
  );
};

export default SignalRContext;
