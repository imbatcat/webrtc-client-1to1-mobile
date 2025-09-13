import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { useSignalR } from "./signalrContext";
import { useWebRTC } from "./webrtcContext";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ConnectionStates } from "../services/signalr/ConnectionStates";
import * as Notifications from "expo-notifications";
import { AppState } from "react-native";
import AppStates from "../constants/AppStates";
import { hide } from "expo-router/build/utils/splash";
import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";
import SignalrServiceModule from "../modules/signalr-service/src/SignalrServiceModule";

const MeetingStateContext = createContext();

export const useMeetingState = () => {
  const context = useContext(MeetingStateContext);
  if (!context) {
    throw new Error(
      "useMeetingState must be used within a MeetingStateProvider"
    );
  }
  return context;
};
export const MeetingStateProvider = ({ children }) => {
  const router = useRouter();
  const DEFAULT_LOG_INTERVAL = 5000;

  const [callInfo, setCallInfo] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isInBackground, setIsInBackground] = useState(false);
  const [error, setError] = useState(null);

  const [localMediaStream, setLocalMediaStream] = useState(null);
  const [remoteMediaStream, setRemoteMediaStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [skipInitializeCall, setSkipInitializeCall] = useState(false);

  // const { service: signalrService } = useSignalR();
  const { service: webrtcService } = useWebRTC();

  const onToggleFlipCamera = useCallback(() => {
    webrtcService.toggleFlipCamera();
  }, [webrtcService]);

  const onToggleAudio = useCallback(() => {
    webrtcService.toggleAudio();
    setIsAudioMuted(!isAudioMuted);
  }, [webrtcService, isAudioMuted]);

  const onToggleVideo = useCallback(() => {
    webrtcService.toggleVideo();
    setIsVideoMuted(!isVideoMuted);
  }, [webrtcService, isVideoMuted]);

  const onToggleMinimize = useCallback(() => {
    console.log("onToggleMinimize", isMinimized);
    setIsMinimized(!isMinimized);
  }, [isMinimized]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log("notification response received", response);
        if (
          response.notification.request.content.data.action === "return_to_call"
        ) {
          if (isMinimized) {
            onToggleMinimize();
          } else {
            console.log("username", callInfo.username);
            router.navigate("/meeting", {
              username: callInfo.username,
            });
          }
        }
      }
    );

    return () => {
      subscription?.remove();
    };
  }, [isMinimized, onToggleMinimize, callInfo]);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, []);

  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      console.log("handleAppStateChange", nextAppState);

      if (nextAppState === AppStates.BACKGROUND && isInCall) {
        console.log("App backgrounded during call - showing notification");
        setIsInBackground(true);
        await showCallNotifications();
        await startBackgroundTask();
      } else if (nextAppState === AppStates.ACTIVE && isInBackground) {
        console.log("App foregrounded after call - stopping notification");
        setIsInBackground(false);
        await hideCallNotifications();
        await stopBackgroundTask();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );

    return () => {
      subscription?.remove();
    };
  }, [isInCall, isInBackground, startBackgroundTask, stopBackgroundTask]);

  const showCallNotifications = useCallback(async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Video Call in Progress",
          body: `Click to return to call`,
          data: { action: "return_to_call" },
          sticky: true,
          priority: "high",
        },
        trigger: null, // show immediately
      });
    } catch (error) {
      console.error("Failed to show call notification:", error);
    }
  }, [callInfo]);

  const hideCallNotifications = useCallback(async () => {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error("Failed to hide call notification:", error);
    }
  }, []);

  const startBackgroundTask = useCallback(async () => {
    try {
      console.log("starting background task");
      console.log("background task registered");
    } catch (error) {
      console.error("Failed to start background task:", error);
    }
  }, []);

  const stopBackgroundTask = useCallback(async () => {
    try {
      console.log("stopping background task");

      console.log("background task unregistered");
    } catch (error) {
      console.error("Failed to stop background task:", error);
    }
  }, []);
  const startCall = useCallback(
    async (
      username,
      roomId,
      logInverval = DEFAULT_LOG_INTERVAL,
      logStats = true
    ) => {
      console.log("startCall", username, roomId, logInverval, logStats);
      console.log("getConnectionStatus");
      const initializeWebRTC = async () => {
        webrtcService.setLocalStreamCallback((stream) => {
          setLocalMediaStream(stream);
        });
        webrtcService.setOnTrackCallback((stream) => {
          setRemoteMediaStream(stream);
        });

        await webrtcService.initializeConnection(
          roomId ? roomId : "E1D7AE1C-B7D5-43D7-8811-A13E8AEC983A",
          username
        );
        webrtcService.startStatsCollection(
          (stats) => {
            if (logStats) {
              // webrtcService.logCallQualityStats(stats);
            }
          },
          logInverval ? parseInt(logInverval) : DEFAULT_LOG_INTERVAL
        );

        setIsInCall(true);

        SignalrServiceModule.removeListener("onConnected", () =>
          initializeWebRTC()
        );
      };

      if (
        (await SignalrServiceModule.getConnectionStatus()) ===
        ConnectionStates.CONNECTED.toLocaleLowerCase()
      ) {
        console.log("startCall onConnected");
        await initializeWebRTC();
      } else {
        SignalrServiceModule.addListener("onConnected", () =>
          initializeWebRTC()
        );
        // signalrService.onEvent("onConnected", initializeWebRTC);
      }
    },
    [webrtcService]
  );

  const endCall = useCallback(() => {
    if (localMediaStream) {
      localMediaStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    if (remoteMediaStream) {
      remoteMediaStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
    webrtcService.closeConnection();
    webrtcService.setOnTrackCallback(null);
    webrtcService.setLocalStreamCallback(null);

    setSkipInitializeCall(false);
    setIsInCall(false);
    setIsMinimized(false);
    setIsAudioMuted(false);
    setIsVideoMuted(false);
    setIsLoading(false);
    setError(null);

    router.navigate("/navigation");
  }, [webrtcService, localMediaStream, remoteMediaStream]);
  return (
    <MeetingStateContext.Provider
      value={{
        isInCall,
        isMinimized,
        isInBackground,
        localMediaStream,
        remoteMediaStream,
        isAudioMuted,
        isVideoMuted,
        isLoading,
        error,
        callInfo,
        skipInitializeCall,

        startCall,
        endCall,
        onToggleMinimize,
        onToggleAudio,
        onToggleVideo,
        onToggleFlipCamera,
        setCallInfo,
        showCallNotifications,
        hideCallNotifications,
        startBackgroundTask,
        stopBackgroundTask,
        setSkipInitializeCall,
      }}
    >
      {children}
    </MeetingStateContext.Provider>
  );
};
