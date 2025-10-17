import { View, Text } from "react-native";
import { RTCView } from "react-native-webrtc";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMeetingState } from "../context/meetingStateContext";
import DraggableContainer from "../components/DraggableContainer";
import MeetingMenuBar from "../components/MeetingMenuBar";
import MeetingAlertModal from "../components/MeetingAlertModal";
import { useRouter } from "expo-router";

export default function Meeting() {
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("");
  const router = useRouter();
  const [containerLocation, setContainerLocation] = useState({
    x: 5,
    y: 5,
  });

  // Get everything from global context
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
    showExpirationAlert,
    expirationAlertMessage,
    stopMeeting,
    stopMeetingMessage,

    // Methods
    setCallInfo,
    startCall,
    endCall,
    onToggleAudio,
    onToggleVideo,
    onToggleFlipCamera,
    onToggleMinimize,
    setShowExpirationAlert,
    setStopMeeting,
    setStopMeetingMessage,
  } = useMeetingState();

  // Handle end call with navigation
  const handleEndCall = () => {
    endCall();
    router.navigate("/navigation");
  };
  // Load user data from AsyncStorage and initialize call
  useEffect(() => {
    console.log(
      "skipInitializeCall",
      skipInitializeCall,
      "callInfo.username",
      callInfo?.username
    );
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
          initialPosition={containerLocation}
          setDraggableContainerPosition={setContainerLocation}
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
          initialPosition={containerLocation}
          setDraggableContainerPosition={setContainerLocation}
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
      {showExpirationAlert && (
        <MeetingAlertModal
          visible={showExpirationAlert}
          message={expirationAlertMessage}
          onDismiss={() => {
            setShowExpirationAlert(false);
          }}
        />
      )}
      {stopMeeting && (
        <MeetingAlertModal
          visible={stopMeeting}
          message={stopMeetingMessage}
          onDismiss={() => {
            setStopMeeting(false);
            router.navigate("/navigation");
          }}
        />
      )}
    </>
  );
}
