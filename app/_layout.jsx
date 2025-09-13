import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Slot, Stack } from "expo-router";
import { WebRTCProvider } from "../context/webrtcContext";
import { registerGlobals } from "react-native-webrtc";
import { SignalRProvider } from "../context/signalrContext";
import { MeetingStateProvider } from "../context/meetingStateContext";
import FloatingVideoCall from "../components/FloatingVideoCall";
import signalrService from "../services/signalr/service";
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
      {/* <SignalRProvider> */}
      <WebRTCProvider>
        <MeetingStateProvider>
          <Slot />
          <FloatingVideoCall />
        </MeetingStateProvider>
      </WebRTCProvider>
      {/* </SignalRProvider> */}
    </GestureHandlerRootView>
  );
}
