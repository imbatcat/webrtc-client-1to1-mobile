import { mediaDevices } from "react-native-webrtc";
import signalrService from "../signalr/service";
import registerHandlers from "../signalr/registerHandlers";
import unregisterHandlers from "../signalr/unregisterHandlers";
import { HUB_METHODS, CLIENT_METHODS } from "../signalr/signalingMethods";

class WebRTCService {
  #peerConnection = null;
  #localStream = null;
  #isMakingOffer = false;
  #isPolite = false;
  #isSettingRemoteAnswerPending = false;
  #isIgnoreOffer = false;
  #roomId;
  #username = null;
  #iceCandidateQueue = [];
  #localStreamCallback = null;
  #onTrackCallback = null;

  #handleMessageReceived = this.handleMessageReceived.bind(this);
  #handleCandidateReceived = this.handleCandidateReceived.bind(this);
  #handleUserLeft = this.handleUserLeft.bind(this);

  constructor(username) {
    this.#username = username;
  }

  handleOnTrack({ track, streams }) {
    console.log(
      `WebRTC [${this.#username}]: ontrack event - track kind:`,
      track.kind,
      "track id:",
      track.id
    );
    console.log(
      `WebRTC [${this.#username}]: ontrack event - track readyState:`,
      track.readyState
    );
    console.log(
      `WebRTC [${this.#username}]: ontrack event - track muted:`,
      track.muted
    );

    if (streams?.[0] && this.#onTrackCallback) {
      console.log(
        `WebRTC [${this.#username}]: calling onTrackCallback with stream:`,
        streams[0].id
      );
      this.#onTrackCallback(streams[0]);
    }

    track.onunmute = () => {
      console.log(`WebRTC [${this.#username}]: track ${track.kind} unmuted`);
      if (streams?.[0] && this.#onTrackCallback) {
        console.log(
          `WebRTC [${this.#username}]: remote stream (onunmute)`,
          streams[0]
        );
        this.#onTrackCallback(streams[0]);
      }
    };

    track.onmute = () => {
      console.log(`WebRTC [${this.#username}]: track ${track.kind} muted`);
      if (this.#onTrackCallback) {
        this.#onTrackCallback(null);
      }
    };
  }

  getMediaConstraints() {
    return {
      audio: true,
      video: true,
    };
  }

  getPCConfig() {
    return {
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
      ],
    };
  }

  async initializeConnection(roomId) {
    try {
      if (roomId) {
        this.#roomId = roomId;
      }
      this.#peerConnection = new RTCPeerConnection(this.getPCConfig());
      this.setupWebRtcHandlers();

      console.log(
        `WebRTC [${this.#username}]: Initializing connection for room:`,
        this.#roomId
      );

      if (roomId) {
        this.#isPolite = await signalrService.invokeHubMethod(
          HUB_METHODS.JOIN_ROOM,
          roomId
        );
      }

      console.log(
        `WebRTC [${this.#username}]: Room joined, isPolite:`,
        this.#isPolite
      );

      await this.collectLocalStream();

      for (const track of this.#localStream.getTracks()) {
        this.#peerConnection.addTrack(track, this.#localStream);
      }
    } catch (error) {
      console.warn(`WebRTC [${this.#username}]: Error initializing connection`);
      console.error(error);
      throw error;
    }
  }

  async handleNegotiationNeeded() {
    if (!this.#peerConnection) {
      return;
    }

    console.log(`WebRTC [${this.#username}]: negotiation needed`);
    try {
      this.#isMakingOffer = true;
      const offer = await this.#peerConnection.createOffer();
      console.log(`WebRTC [${this.#username}]: offer created`);
      await this.#peerConnection.setLocalDescription(offer);
      console.log(
        `WebRTC [${
          this.#username
        }]: signaling state after setLocalDescription:`,
        this.#peerConnection.signalingState
      );

      await signalrService.invokeHubMethod(
        HUB_METHODS.SEND_MESSAGE,
        this.#roomId,
        offer
      );
      console.log(`WebRTC [${this.#username}]: offer sent`);
    } catch (error) {
      console.warn(
        `WebRTC [${this.#username}]: Error handling negotiation needed`
      );
      console.error(error);
    } finally {
      this.#isMakingOffer = false;
    }
  }

  async closeConnection() {
    console.log(`WebRTC [${this.#username}]: Closing connection`);
    this.localStream = null;
    if (this.#localStreamCallback) {
      this.#localStreamCallback(null);
    }

    await signalrService.invokeHubMethod(HUB_METHODS.LEAVE_ROOM, this.#roomId);

    this.#peerConnection.onnegotiationneeded = null;
    this.#peerConnection.ontrack = null;
    this.#peerConnection.onicecandidate = null;
    this.#peerConnection.onicegatheringstatechange = null;
    this.#peerConnection.oniceconnectionstatechange = null;

    this.#peerConnection.close();
    this.#peerConnection = null;
    this.unregisterSignalrHandlers();
  }

  setupWebRtcHandlers() {
    this.#peerConnection.onnegotiationneeded = () =>
      this.handleNegotiationNeeded();
    this.#peerConnection.ontrack = ({ track, streams }) =>
      this.handleOnTrack({ track, streams });
    this.#peerConnection.onicecandidate = (event) => {
      this.handleOnIceCandidate(event);
    };
    this.#peerConnection.onicegatheringstatechange = () =>
      this.handleIceGatheringStateChange();
    this.#peerConnection.oniceconnectionstatechange = () =>
      this.handleIceConnectionStateChange();
  }

  async handleUserLeft(username) {
    console.log(`WebRTC [${this.#username}]: User left:`, username);

    this.#isPolite = true;

    if (this.#onTrackCallback) {
      this.#onTrackCallback(null);
    }

    this.#isMakingOffer = false;
    this.#isSettingRemoteAnswerPending = false;
    this.#isIgnoreOffer = false;

    if (this.#localStream) {
      this.#localStream.getTracks().forEach((track) => track.stop());
      this.#localStream = null;
    }

    if (this.#peerConnection) {
      this.#peerConnection.onnegotiationneeded = null;
      this.#peerConnection.ontrack = null;
      this.#peerConnection.onicecandidate = null;
      this.#peerConnection.onicegatheringstatechange = null;
      this.#peerConnection.oniceconnectionstatechange = null;
      this.#peerConnection.close();
      this.#peerConnection = null;
    }

    this.#iceCandidateQueue = [];

    this.initializeConnection();
  }

  async handleMessageReceived(message) {
    if (!this.#peerConnection) {
      return;
    }

    try {
      console.log(
        `WebRTC [${this.#username}]: signaling state:`,
        this.#peerConnection.signalingState,
        "isSettingRemoteAnswerPending:",
        this.#isSettingRemoteAnswerPending,
        "isMakingOffer:",
        this.#isMakingOffer
      );
      const readyForOffer =
        !this.#isMakingOffer &&
        (this.#peerConnection.signalingState == "stable" ||
          this.#isSettingRemoteAnswerPending); // when in middle of setting a remote answer, we can discard it and accept the new one

      const isOfferCollision = message.type === "offer" && !readyForOffer;

      this.#isIgnoreOffer = isOfferCollision && !this.#isPolite;

      console.log(
        `WebRTC [${this.#username}]: readyForOffer:`,
        readyForOffer,
        "isOfferCollision:",
        isOfferCollision,
        "isIgnoreOffer:",
        this.#isIgnoreOffer
      );

      if (this.#isIgnoreOffer) {
        return;
      }

      this.#isSettingRemoteAnswerPending = message.type === "answer";

      console.log(
        `WebRTC [${this.#username}]: Processing ${message.type} message`
      );
      await this.#peerConnection.setRemoteDescription(message);
      for (const candidate of this.#iceCandidateQueue) {
        await this.#peerConnection.addIceCandidate(candidate);
      }
      this.#iceCandidateQueue = [];
      this.#isSettingRemoteAnswerPending = false;

      if (message.type === "offer") {
        console.log(`WebRTC [${this.#username}]: Setting local description`);
        await this.#peerConnection.setLocalDescription();
        await signalrService.invokeHubMethod(
          HUB_METHODS.SEND_MESSAGE,
          this.#roomId,
          this.#peerConnection.localDescription
        );
      }
    } catch (error) {
      this.#isSettingRemoteAnswerPending = false;
      // if (this.#peerConnection.signalingState !== "stable") {
      //   this.initializeConnection();
      // }
      console.warn(
        `WebRTC [${this.#username}]: Error handling message received`
      );
      console.error(`WebRTC [${this.#username}]: Message:`, message);
      console.error(
        `WebRTC [${this.#username}]: Remote description:`,
        this.#peerConnection.remoteDescription
      );
      console.error(
        `WebRTC [${this.#username}]: Local description:`,
        this.#peerConnection.localDescription
      );
      console.error(error);
    }
  }

  async handleCandidateReceived(candidate) {
    try {
      if (!this.#peerConnection || !candidate) {
        return;
      }
      if (this.#peerConnection.remoteDescription === null) {
        this.#iceCandidateQueue.push(candidate);
      } else {
        await this.#peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.warn(
        `WebRTC [${this.#username}]: Error handling candidate received`
      );
      console.error(error);
      if (!this.#isIgnoreOffer) {
        throw error;
      }
    }
  }

  async handleIceGatheringStateChange() {
    switch (this.#peerConnection.iceGatheringState) {
      case "new":
        console.log(`WebRTC [${this.#username}]: new ice candidate`);
        break;
      case "gathering":
        console.log(`WebRTC [${this.#username}]: gathering ice candidate`);
        break;
      case "complete":
        console.log(`WebRTC [${this.#username}]: gathering has ended`);
        break;
    }
  }

  async handleOnIceCandidate(event) {
    console.log(`WebRTC [${this.#username}]: candidate:`, event.candidate);

    await signalrService.invokeHubMethod(
      HUB_METHODS.SEND_ICE_CANDIDATE,
      this.#roomId,
      event.candidate
    );

    console.log(`WebRTC [${this.#username}]: candidate sent`);
  }

  async handleIceConnectionStateChange() {
    switch (this.#peerConnection.iceConnectionState) {
      case "new":
        console.log(`WebRTC [${this.#username}]: new ice connection`);
        break;
      case "checking":
        console.log(`WebRTC [${this.#username}]: checking ice connection`);
        break;
      case "connected":
        console.log(`WebRTC [${this.#username}]: connected ice connection`);
        break;
      case "completed":
        console.log(`WebRTC [${this.#username}]: completed ice connection`);
        break;
      case "failed":
        console.log(`WebRTC [${this.#username}]: failed ice connection`);
        break;
      case "disconnected":
        console.log(`WebRTC [${this.#username}]: disconnected ice connection`);
        break;
      case "closed":
        console.log(`WebRTC [${this.#username}]: closed ice connection`);
        break;
    }
  }
  registerSignalrHandlers() {
    registerHandlers(
      signalrService.connection,
      signalrService.boundTriggerCallback
    );

    signalrService.onEvent(
      CLIENT_METHODS.RECEIVE_MESSAGE,
      this.#handleMessageReceived
    );
    signalrService.onEvent(
      CLIENT_METHODS.RECEIVE_ICE_CANDIDATE,
      this.#handleCandidateReceived
    );
    signalrService.onEvent(CLIENT_METHODS.USER_LEFT, this.#handleUserLeft);
  }

  unregisterSignalrHandlers() {
    unregisterHandlers(
      signalrService.connection,
      signalrService.boundTriggerCallback
    );

    signalrService.offEvent(
      CLIENT_METHODS.RECEIVE_MESSAGE,
      this.#handleMessageReceived
    );
    signalrService.offEvent(
      CLIENT_METHODS.RECEIVE_ICE_CANDIDATE,
      this.#handleCandidateReceived
    );
    signalrService.offEvent(CLIENT_METHODS.USER_LEFT, this.#handleUserLeft);
  }

  setOnTrackCallback(callback) {
    this.#onTrackCallback = callback;
  }

  setLocalStreamCallback(callback) {
    this.#localStreamCallback = callback;
  }
  get peerConnection() {
    return this.#peerConnection;
  }

  get localStream() {
    return this.#localStream;
  }

  set localStream(stream) {
    this.#localStream = stream;
  }

  async collectLocalStream() {
    const stream = await mediaDevices.getUserMedia(this.getMediaConstraints());

    this.#localStream = stream;
    if (this.#localStreamCallback) {
      this.#localStreamCallback(stream);
    }
  }
}

export default WebRTCService;
