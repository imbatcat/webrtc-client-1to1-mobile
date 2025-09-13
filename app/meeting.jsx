import { View, Text } from "react-native";
import { RTCView } from "react-native-webrtc";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMeetingState } from "../context/meetingStateContext";
import DraggableContainer from "../components/DraggableContainer";
import MeetingMenuBar from "../components/MeetingMenuBar";

export default function Meeting() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");

  const {
    // State
    localMediaStream,
    remoteMediaStream,
    isLoading,
    error,
    isAudioMuted,
    isVideoMuted,
    isMinimized,
    skipInitializeCall,
    callInfo,

    // Methods
    setCallInfo,
    startCall,
    endCall,
    onToggleAudio,
    onToggleVideo,
    onToggleFlipCamera,
    onToggleMinimize,
  } = useMeetingState();

  const handleEndCall = () => {
    endCall();
  };

  useEffect(() => {
    console.log("skipInitializeCall", skipInitializeCall);
    if (skipInitializeCall) {
      return;
    }
    const initializeCall = async () => {
      try {
        const storedUsername = await AsyncStorage.getItem("username");
        const storedRoomId = await AsyncStorage.getItem("roomId");

        if (storedUsername && storedRoomId) {
          setUsername(storedUsername);
          setRoomId(storedRoomId);

          console.log("storedUsername", storedUsername);
          console.log("storedRoomId", storedRoomId);
          setCallInfo({
            username: storedUsername,
            roomId: storedRoomId,
          });
          startCall(storedUsername, storedRoomId, undefined, false);
        }
      } catch (error) {
        console.error("Error loading user data:", error);
      }
    };
    initializeCall();
  }, [setCallInfo, startCall, skipInitializeCall]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Loading camera...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Error: {error}</Text>
      </View>
    );
  }

  if (isMinimized) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Call minimized - Check floating video</Text>
      </View>
    );
  }

  return (
    <>
      {/* Local video (draggable) */}
      {localMediaStream && !isVideoMuted ? (
        <DraggableContainer
          initialPosition={{ x: 5, y: 5 }}
          setDraggableContainerPosition={() => {}} // Simplified for now
          onSnapToCorner={(corner) => console.log("Snapped to:", corner)}
          cornerOffset={{ top: 5, left: 5, right: 10, bottom: 5 }}
        >
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
        </DraggableContainer>
      ) : (
        <DraggableContainer
          initialPosition={{ x: 5, y: 5 }}
          setDraggableContainerPosition={() => {}}
          onSnapToCorner={(corner) => console.log("Snapped to:", corner)}
          cornerOffset={{ top: 5, left: 5, right: 10, bottom: 5 }}
        >
          <View
            style={{
              width: 150,
              height: 200,
              backgroundColor: "#000",
              borderRadius: 8,
              margin: 5,
            }}
          />
        </DraggableContainer>
      )}
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        {remoteMediaStream ? (
          <RTCView
            mirror={false}
            objectFit={"cover"}
            streamURL={remoteMediaStream.toURL()}
            zOrder={1}
            style={{
              width: 400,
              height: 500,
              backgroundColor: "#000",
              borderRadius: 8,
              margin: 5,
            }}
          />
        ) : (
          <View
            style={{
              width: 400,
              height: 500,
              backgroundColor: "#000",
              borderRadius: 8,
              margin: 5,
            }}
          />
        )}
      </View>
      <MeetingMenuBar
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isMinimized={isMinimized}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onToggleEndCall={handleEndCall}
        onToggleFlipCamera={onToggleFlipCamera}
        onToggleMinimize={onToggleMinimize}
      />
    </>
  );
}
