import { CLIENT_METHODS } from "./signalingMethods";
export function registerMeetingManagementHandlers(connection, triggerCallback) {
  console.log("registerMeetingManagementHandlers");
  connection.on(CLIENT_METHODS.SHOW_EXPIRATION_ALERT, () => {
    console.log("CLIENT_METHODS.SHOW_EXPIRATION_ALERT");
    triggerCallback(CLIENT_METHODS.SHOW_EXPIRATION_ALERT);
  });

  connection.on(CLIENT_METHODS.STOP_MEETING, () => {
    console.log("CLIENT_METHODS.STOP_MEETING");
    triggerCallback(CLIENT_METHODS.STOP_MEETING);
  });
}

export default registerMeetingManagementHandlers;
