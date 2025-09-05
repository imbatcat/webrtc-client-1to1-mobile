import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Slot, Stack } from "expo-router";
import { WebRTCProvider } from "../context/webrtcContext";
import { registerGlobals } from "react-native-webrtc";
import { SignalRProvider } from "../context/signalrContext";
// import * as NavigationBar from "expo-navigation-bar";

export default function RootLayout() {
  // useEffect(() => {
  //   NavigationBar.setVisibilityAsync("hidden");
  //   return () => {
  //     NavigationBar.setVisibilityAsync("visible");
  //   };
  // }, []);
  registerGlobals();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SignalRProvider>
        <WebRTCProvider>
          <Slot />
        </WebRTCProvider>
      </SignalRProvider>
    </GestureHandlerRootView>
  );
}
