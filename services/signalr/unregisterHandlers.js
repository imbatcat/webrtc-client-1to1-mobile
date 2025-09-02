import { CLIENT_METHODS } from "./signalingMethods";
export function unregisterHandlers(connection, triggerCallback) {
  connection.off(CLIENT_METHODS.RECEIVE_MESSAGE, (message) => {
    triggerCallback(CLIENT_METHODS.RECEIVE_MESSAGE, message);
  });

  connection.off(CLIENT_METHODS.RECEIVE_ICE_CANDIDATE, (candidate) => {
    triggerCallback(CLIENT_METHODS.RECEIVE_ICE_CANDIDATE, candidate);
  });

  connection.off(CLIENT_METHODS.USER_LEFT, (username) => {
    triggerCallback(CLIENT_METHODS.USER_LEFT, username);
  });

  connection.off(CLIENT_METHODS.ROOM_DOES_NOT_EXIST, (roomId) => {
    triggerCallback(CLIENT_METHODS.ROOM_DOES_NOT_EXIST, roomId);
  });

  connection.off(CLIENT_METHODS.NOT_AUTHORIZED_TO_JOIN, (roomId) => {
    triggerCallback(CLIENT_METHODS.NOT_AUTHORIZED_TO_JOIN, roomId);
  });
}
export default unregisterHandlers;
