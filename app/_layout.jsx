import React from "react";
import { Stack } from "expo-router";
import { registerGlobals } from "react-native-webrtc";

export default function RootLayout() {
  registerGlobals();
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
        initialRouteName="index"
      />
      <Stack.Screen name="(meeting)" options={{ title: "Meeting" }} />
    </Stack>
  );
}
