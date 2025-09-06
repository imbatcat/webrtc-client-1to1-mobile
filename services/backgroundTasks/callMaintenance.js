import * as TaskManager from "expo-task-manager";
import * as BackgroundTask from "expo-background-task";

const CALL_MAINTENANCE_TASK = "CALL_MAINTENANCE_TASK";

TaskManager.defineTask(
  CALL_MAINTENANCE_TASK,
  async ({ data, error, executionInfo }) => {
    console.log("executing bg task: ", executionInfo);

    if (error) {
      console.error("Call maintenance task error: ", error);
      return;
    }

    try {
      console.log("start bg task");

      await maintainSignalRConnection();

      await maintainWebRTCConnection();

      await updateCallNotifications();
    } catch (error) {
      console.error("Call maintenance task error: ", error);
    } finally {
      console.log("bg task completed");
    }
  }
);

const maintainSignalRConnection = async () => {
  console.log("maintaining signalr connection");
};
const maintainWebRTCConnection = async () => {
  console.log("maintaining webrtc connection");
};
const updateCallNotifications = async () => {
  try {
    const callDuration = Date.now() - callStartTime;
    const minutes = Math.floor(callDuration / 60000);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Video Call in Progress",
        body: `Connected for ${minutes} minutes`,
        data: { action: "return_to_call" },
      },
      trigger: null,
    });
  } catch (error) {
    console.error("Notification update failed:", error);
  }
};

export { CALL_MAINTENANCE_TASK };
