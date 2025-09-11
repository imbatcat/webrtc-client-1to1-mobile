package expo.modules.signalrservice;

public enum HubMethods {
    JOIN_ROOM("JoinRoom"),
    LEAVE_ROOM("LeaveRoom"),
    SEND_MESSAGE("SendMessage"),
    SEND_ICE_CANDIDATE("SendIceCandidate"),
    PING("Ping");

    private final String method;

    HubMethods(String method) {
        this.method = method;
    }

    public String getMethod() {
        return method;
    }
}

