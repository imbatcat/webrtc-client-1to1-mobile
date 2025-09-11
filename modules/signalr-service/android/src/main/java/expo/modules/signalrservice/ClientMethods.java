package expo.modules.signalrservice;

public enum ClientMethods {
    ROOM_DOES_NOT_EXIST("RoomDoesNotExist"),
    NOT_AUTHORIZED_TO_JOIN("NotAuthorizedToJoin"),
    USER_JOINED("UserJoined"),
    USER_LEFT("UserLeft"),
    RECEIVE_MESSAGE("ReceiveMessage"),
    RECEIVE_ICE_CANDIDATE("ReceiveICECandidate");

    private final String method;

    ClientMethods(String method) {
        this.method = method;
    }

    public String getMethod() {
        return method;
    }
}
