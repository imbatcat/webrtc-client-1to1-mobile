import { useMeetingState } from "../context/meetingStateContext";
import { View, Text } from "react-native";
import DraggableContainer from "./DraggableContainer";
import { RTCView } from "react-native-webrtc";
import { useState } from "react";
import MeetingMenuBar from "./MeetingMenuBar";
import { router } from "expo-router";
export default function FloatingVideoCall() {
  const {
    callInfo,
    isInCall,
    isAudioMuted,
    isVideoMuted,
    isMinimized,
    localMediaStream,
    remoteMediaStream,

    onToggleAudio,
    onToggleVideo,
    endCall,
    onToggleFlipCamera,
    onToggleMinimize,
  } = useMeetingState();
  const [draggableContainerPosition, setDraggableContainerPosition] = useState({
    x: 5,
    y: 5,
  });

  const handleOnToggleMinimize = () => {
    router.navigate("/meeting");
    onToggleMinimize();
  };

  if (!isInCall || !isMinimized) {
    return null;
  }

  return (
    <DraggableContainer
      initialPosition={draggableContainerPosition}
      setDraggableContainerPosition={setDraggableContainerPosition}
      onSnapToCorner={(corner) => console.log("Snapped to:", corner)}
      cornerOffset={{ top: 5, left: 5, right: 10, bottom: 5 }}
    >
      <>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {remoteMediaStream ? (
            <RTCView
              mirror={false}
              objectFit={"cover"}
              streamURL={remoteMediaStream.toURL()}
              zOrder={1}
              style={{
                width: 150,
                height: 200,
                backgroundColor: "#000",
                borderRadius: 8,
                margin: 5,
              }}
            />
          ) : (
            <View
              style={{
                width: 150,
                height: 200,
                backgroundColor: "#000",
                borderRadius: 8,
                margin: 5,
              }}
            ></View>
          )}
          {localMediaStream && !isVideoMuted ? (
            <RTCView
              mirror={true}
              objectFit={"cover"}
              streamURL={localMediaStream.toURL()}
              zOrder={2}
              style={{
                width: 150,
                height: 200,
                backgroundColor: "#000",
                borderRadius: 8,
                margin: 5,
              }}
            />
          ) : (
            <View
              style={{
                width: 150,
                height: 200,
                backgroundColor: "#000",
                borderRadius: 8,
                margin: 5,
              }}
            ></View>
          )}
        </View>
        <MeetingMenuBar
          isAudioMuted={isAudioMuted}
          isVideoMuted={isVideoMuted}
          isMinimized={isMinimized}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onToggleEndCall={endCall}
          onToggleFlipCamera={onToggleFlipCamera}
          onToggleMinimize={handleOnToggleMinimize}
        />
      </>
    </DraggableContainer>
  );
}
