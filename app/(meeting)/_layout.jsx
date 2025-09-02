import { Slot } from "expo-router";
import { SignalRProvider } from "../../context/signalrContext";
import { WebRTCProvider } from "../../context/webrtcContext";

export default function MeetingGroupLayout() {
  return (
    <SignalRProvider>
      <WebRTCProvider>
        <Slot />
      </WebRTCProvider>
    </SignalRProvider>
  );
}
