import { View, Text } from "react-native";
import { RTCView } from "react-native-webrtc";
import { useState, useEffect } from "react";
import { useSignalR } from "../../context/signalrContext";
import { useWebRTC } from "../../context/webrtcContext";
export default function Meeting() {
  const { service: signalrService } = useSignalR();
  const { service: webrtcService } = useWebRTC();
  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const initializeMedia = async () => {
      try {
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
            "E1D7AE1C-B7D5-43D7-8811-A13E8AEC983A"
          );

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

    signalrService.onEvent("onConnected", initializeMedia);

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
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      {localMediaStream ? (
        <View style={{ flex: 1, flexDirection: "row" }}>
          <RTCView
            mirror={true}
            objectFit={"cover"}
            streamURL={localMediaStream.toURL()}
            zOrder={0}
            style={{
              width: 150,
              height: 200,
              backgroundColor: "#000",
              borderRadius: 8,
              margin: 5,
            }}
          />
          {remoteMediaStream ? (
            <RTCView
              mirror={false}
              objectFit={"cover"}
              streamURL={remoteMediaStream.toURL()}
              zOrder={0}
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
                backgroundColor: "#00000000",
                borderRadius: 8,
                margin: 5,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff" }}>Waiting for remote stream</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={{ justifyContent: "center", alignItems: "center" }}>
          <Text>No local media stream</Text>
          <Text style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
            Debug: localMediaStream is {localMediaStream ? "truthy" : "falsy"}
          </Text>
        </View>
      )}
    </View>
  );
}
