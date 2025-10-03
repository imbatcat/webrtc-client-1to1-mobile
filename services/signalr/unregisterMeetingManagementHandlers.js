import { CLIENT_METHODS } from "./signalingMethods";

export function unregisterMeetingManagementHandlers(connection) {
  connection.off(CLIENT_METHODS.SHOW_EXPIRATION_ALERT);
  connection.off(CLIENT_METHODS.STOP_MEETING);
}

export default unregisterMeetingManagementHandlers;
