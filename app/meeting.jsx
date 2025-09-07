import { View, Text } from "react-native";
import { RTCView } from "react-native-webrtc";
import { useState, useEffect } from "react";
import { useSignalR } from "../context/signalrContext";
import { useWebRTC } from "../context/webrtcContext";
import DraggableContainer from "../components/DraggableContainer";
import MeetingMenuBar from "../components/MeetingMenuBar";
import { router, useLocalSearchParams } from "expo-router";
import { ConnectionStates } from "../services/signalr/ConnectionStates";

export default function Meeting() {
  const { username } = useLocalSearchParams();
  const { service: signalrService } = useSignalR();
  const { service: webrtcService } = useWebRTC();
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [draggableContainerPosition, setDraggableContainerPosition] = useState({
    x: 5,
    y: 5,
  });

  const onToggleAudio = () => {
    webrtcService.toggleAudio();
    setIsAudioMuted(!isAudioMuted);
  };
  const onToggleVideo = () => {
    webrtcService.toggleVideo();
    setIsVideoMuted(!isVideoMuted);
  };
  const onToggleEndCall = () => {
    webrtcService.closeConnection();
    router.navigate("/");
    setIsLoading(false);
    setError(null);
    setLocalMediaStream(null);
    setRemoteMediaStream(null);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
  };
  const onToggleFlipCamera = () => {
    webrtcService.toggleFlipCamera();
  };
  useEffect(() => {
    let mounted = true;

    const initializeMedia = async () => {
      try {
        console.log("initializeMedia");
        setIsLoading(true);
        setError(null);

        if (mounted) {
          webrtcService.setLocalStreamCallback((stream) => {
            setLocalMediaStream(stream);
          });
          webrtcService.setOnTrackCallback((stream) => {
            setRemoteMediaStream(stream);
          });

          await webrtcService.initializeConnection(
            "E1D7AE1C-B7D5-43D7-8811-A13E8AEC983A",
            username
          );
          webrtcService.startStatsCollection((stats) => {
            // webrtcService.logCallQualityStats(stats);
          }, 5000);

          setIsLoading(false);
        }
      } catch (err) {
        console.error("Error getting user media:", err);
        if (mounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    if (signalrService.connectionStatus.state === ConnectionStates.CONNECTED) {
      initializeMedia();
    } else {
      signalrService.onEvent("onConnected", initializeMedia);
    }

    return () => {
      signalrService.offEvent("onConnected", initializeMedia);
      if (localMediaStream) {
        localMediaStream.getTracks().forEach((track) => {
          track.stop();
        });
        setLocalMediaStream(null);
      }

      if (remoteMediaStream) {
        remoteMediaStream.getTracks().forEach((track) => {
          track.stop();
        });
        setRemoteMediaStream(null);
      }

      webrtcService.closeConnection();

      webrtcService.setOnTrackCallback(null);
      webrtcService.setLocalStreamCallback(null);
      mounted = false;
    };
  }, [webrtcService]);

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

  return (
    <>
      {localMediaStream && !isVideoMuted ? (
        <DraggableContainer
          initialPosition={draggableContainerPosition}
          setDraggableContainerPosition={setDraggableContainerPosition}
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
          initialPosition={draggableContainerPosition}
          setDraggableContainerPosition={setDraggableContainerPosition}
          onSnapToCorner={(corner) => console.log("Snapped to:", corner)}
          cornerOffset={{ top: 5, left: 5, right: 10, bottom: 5 }}
        >
          <View
            style={{
              width: "auto",
              height: "auto",
              maxWidth: "70%",
              maxHeight: "70%",
              backgroundColor: "#000",
              borderRadius: 8,
              margin: 5,
            }}
          ></View>
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
              width: "auto",
              height: "auto",
              maxWidth: "70%",
              maxHeight: "70%",
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
        setIsAudioMuted={setIsAudioMuted}
        setIsVideoMuted={setIsVideoMuted}
        onToggleAudio={onToggleAudio}
        onToggleVideo={onToggleVideo}
        onToggleEndCall={onToggleEndCall}
        onToggleFlipCamera={onToggleFlipCamera}
      />
    </>
  );
}
