import { CLIENT_METHODS } from "./signalingMethods";

export function registerHandlers(connection, triggerCallback) {
  connection.on(CLIENT_METHODS.RECEIVE_MESSAGE, (message) => {
    triggerCallback(CLIENT_METHODS.RECEIVE_MESSAGE, message);
  });

  connection.on(CLIENT_METHODS.RECEIVE_ICE_CANDIDATE, (candidate) => {
    triggerCallback(CLIENT_METHODS.RECEIVE_ICE_CANDIDATE, candidate);
  });

  connection.on(CLIENT_METHODS.USER_JOINED, (username) => {
    triggerCallback(CLIENT_METHODS.USER_JOINED, username);
  });

  connection.on(CLIENT_METHODS.USER_LEFT, (username) => {
    triggerCallback(CLIENT_METHODS.USER_LEFT, username);
  });

  connection.on(CLIENT_METHODS.ROOM_DOES_NOT_EXIST, (roomId) => {
    triggerCallback(CLIENT_METHODS.ROOM_DOES_NOT_EXIST, roomId);
  });

  connection.on(CLIENT_METHODS.NOT_AUTHORIZED_TO_JOIN, (roomId) => {
    triggerCallback(CLIENT_METHODS.NOT_AUTHORIZED_TO_JOIN, roomId);
  });
}
export default registerHandlers;
