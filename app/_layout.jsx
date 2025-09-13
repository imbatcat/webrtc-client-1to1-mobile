import { GestureHandlerRootView } from "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Slot, Stack } from "expo-router";
import { WebRTCProvider } from "../context/webrtcContext";
import { registerGlobals } from "react-native-webrtc";
import { SignalRProvider } from "../context/signalrContext";
import { MeetingStateProvider } from "../context/meetingStateContext";
import FloatingVideoCall from "../components/FloatingVideoCall";
import signalrService from "../services/signalr/service";
import * as Notifications from "expo-notifications";

export default function RootLayout() {
  registerGlobals();
  useEffect(() => {
    const requestNotificationPermissions = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        console.log("Notification permission status:", status);

        if (status !== "granted") {
          console.warn("Notification permissions not granted");
        }
      } catch (error) {
        console.error("Failed to request notification permissions:", error);
      }
    };

    requestNotificationPermissions();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WebRTCProvider>
        <MeetingStateProvider>
          <Slot />
          <FloatingVideoCall />
        </MeetingStateProvider>
      </WebRTCProvider>
    </GestureHandlerRootView>
  );
}
