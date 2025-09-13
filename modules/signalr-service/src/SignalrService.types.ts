import type { StyleProp, ViewStyle } from "react-native";

export type OnMessageReceivedEventPayload = {
  message: object;
};
export type OnReceiveICECandidateEventPayload = {
  candidate: object;
};
export type OnUserJoinedEventPayload = {
  username: string;
};
export type OnUserLeftEventPayload = {
  username: string;
};
export type OnRoomDoesNotExistEventPayload = {
  roomId: string;
};
export type OnNotAuthorizedToJoinEventPayload = {
  roomId: string;
};

export type SignalrServiceModuleEvents = {
  onConnected: () => void;
  onDisconnected: () => void;
  onMessageReceived: (payload: OnMessageReceivedEventPayload) => void;
  onReceiveICECandidate: (payload: OnReceiveICECandidateEventPayload) => void;
  onUserJoined: (payload: OnUserJoinedEventPayload) => void;
  onUserLeft: (payload: OnUserLeftEventPayload) => void;
  onRoomDoesNotExist: (payload: OnRoomDoesNotExistEventPayload) => void;
  onNotAuthorizedToJoin: (payload: OnNotAuthorizedToJoinEventPayload) => void;
};
