import * as signalR from "@microsoft/signalr";
export const ConnectionStates = {
  DISCONNECTED: signalR.HubConnectionState.Disconnected,
  CONNECTING: signalR.HubConnectionState.Connecting,
  CONNECTED: signalR.HubConnectionState.Connected,
  DISCONNECTING: signalR.HubConnectionState.Disconnecting,
  RECONNECTING: signalR.HubConnectionState.Reconnecting,
};
