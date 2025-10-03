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
import { CALL_MAINTENANCE_TASK } from "../services/backgroundTasks/callMaintenance";
import { CLIENT_METHODS } from "../services/signalr/signalingMethods";
import registerMeetingManagementHandlers from "../services/signalr/registerMeetingManagementHandlers";
import unregisterMeetingManagementHandlers from "../services/signalr/unregisterMeetingManagementHandlers";
// import signalrService from "../services/signalr/service";

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
  const [showExpirationAlert, setShowExpirationAlert] = useState(false);
  const [expirationAlertMessage, setExpirationAlertMessage] = useState(
    "Meeting will end in 5 minutes"
  );
  const [stopMeeting, setStopMeeting] = useState(false);
  const [stopMeetingMessage, setStopMeetingMessage] = useState(
    "Meeting has ended, click ok to leave the call"
  );

  const { service: signalrService } = useSignalR();
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
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        CALL_MAINTENANCE_TASK
      );
      if (isRegistered) {
        console.log("background task already registered");
        return;
      }
      await BackgroundTask.registerTaskAsync(CALL_MAINTENANCE_TASK, {
        minimumInterval: 15000,
      });

      console.log("background task registered");
    } catch (error) {
      console.error("Failed to start background task:", error);
    }
  }, []);

  const stopBackgroundTask = useCallback(async () => {
    try {
      console.log("stopping background task");
      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        CALL_MAINTENANCE_TASK
      );

      if (!isRegistered) {
        return;
      }
      await BackgroundTask.unregisterTaskAsync(CALL_MAINTENANCE_TASK);
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
      const initializeWebRTC = async () => {
        registerMeetingManagementHandlers(
          signalrService.connection,
          signalrService.boundTriggerCallback
        );

        signalrService.onEvent(
          CLIENT_METHODS.SHOW_EXPIRATION_ALERT,
          handleShowExpirationAlert
        );
        signalrService.onEvent(CLIENT_METHODS.STOP_MEETING, handleStopMeeting);

        webrtcService.setLocalStreamCallback((stream) => {
          setLocalMediaStream(stream);
        });
        webrtcService.setOnTrackCallback((stream) => {
          setRemoteMediaStream(stream);
        });

        await webrtcService.initializeConnection(
          roomId ? roomId : "e1d7ae1c-b7d5-43d7-8811-a13e8aec983a",
          username
        );
        // webrtcService.startStatsCollection(
        //   (stats) => {
        //     if (logStats) {
        //       // webrtcService.logCallQualityStats(stats);
        //     }
        //   },
        //   logInverval ? parseInt(logInverval) : DEFAULT_LOG_INTERVAL
        // );

        setIsInCall(true);

        signalrService.offEvent("onConnected", initializeWebRTC);
      };

      if (
        signalrService.connectionStatus.state === ConnectionStates.CONNECTED
      ) {
        await initializeWebRTC();
      } else {
        signalrService.onEvent("onConnected", initializeWebRTC);
      }
    },
    [webrtcService, signalrService]
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

    signalrService.offEvent(
      CLIENT_METHODS.SHOW_EXPIRATION_ALERT,
      handleShowExpirationAlert
    );
    signalrService.offEvent(CLIENT_METHODS.STOP_MEETING, handleStopMeeting);
    unregisterMeetingManagementHandlers(signalrService.connection);

  }, [webrtcService, localMediaStream, remoteMediaStream]);

  const handleShowExpirationAlert = useCallback(() => {
    console.log("handleShowExpirationAlert");
    setShowExpirationAlert(true);
    setExpirationAlertMessage("Meeting will end in 5 minutes");
  }, []);

  const handleStopMeeting = useCallback(() => {
    console.log("handleStopMeeting");
    endCall();
    setStopMeeting(true);
  }, [endCall]);

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
        showExpirationAlert,
        expirationAlertMessage,
        stopMeeting,
        stopMeetingMessage,
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
        setShowExpirationAlert,
        setExpirationAlertMessage,
        setStopMeeting,
        setStopMeetingMessage,
      }}
    >
      {children}
    </MeetingStateContext.Provider>
  );
};
