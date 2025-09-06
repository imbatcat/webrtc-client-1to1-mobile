import { mediaDevices } from "react-native-webrtc";
import signalrService from "../signalr/service";
import registerHandlers from "../signalr/registerHandlers";
import unregisterHandlers from "../signalr/unregisterHandlers";
import { HUB_METHODS, CLIENT_METHODS } from "../signalr/signalingMethods";

const iceServers = [
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
  {
    urls: "turn:standard.relay.metered.ca:80",
    username: process.env.EXPO_PUBLIC_TURN_USERNAME,
    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
  },
  {
    urls: "turn:standard.relay.metered.ca:80?transport=tcp",
    username: process.env.EXPO_PUBLIC_TURN_USERNAME,
    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
  },
  {
    urls: "turn:standard.relay.metered.ca:443",
    username: process.env.EXPO_PUBLIC_TURN_USERNAME,
    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
  },
  {
    urls: "turns:standard.relay.metered.ca:443?transport=tcp",
    username: process.env.EXPO_PUBLIC_TURN_USERNAME,
    credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL,
  },
];
// TODO: enforce polite/impolite behavior
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
  #statsInterval = null;
  #statsCallback = null;
  #isStatsCollectionActive = false;

  #handleMessageReceived = this.handleMessageReceived.bind(this);
  #handleCandidateReceived = this.handleCandidateReceived.bind(this);
  #handleUserLeft = this.handleUserLeft.bind(this);

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
      iceServers: iceServers,
    };
  }

  async initializeConnection(roomId, username) {
    try {
      if (roomId) {
        this.#roomId = roomId;
      }
      if (username) {
        this.#username = username;
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

    this.stopStatsCollection();

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

    this.stopStatsCollection();

    this.#isPolite = true; // TODO: enforce polite/impolite behavior

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

  async getStats() {
    if (!this.#peerConnection) {
      console.warn(
        `WebRTC [${this.#username}]: Cannot get stats - no peer connection`
      );
      return null;
    }

    try {
      const stats = await this.#peerConnection.getStats();
      const parsedStats = {
        timestamp: Date.now(),
        connectionState: this.#peerConnection.connectionState,
        iceConnectionState: this.#peerConnection.iceConnectionState,
        iceGatheringState: this.#peerConnection.iceGatheringState,
        signalingState: this.#peerConnection.signalingState,
        stats: {},
      };

      stats.forEach((report) => {
        if (!parsedStats.stats[report.type]) {
          parsedStats.stats[report.type] = [];
        }

        const reportData = {
          id: report.id,
          timestamp: report.timestamp,
          ...Object.fromEntries(
            Object.keys(report)
              .filter((key) => !["id", "timestamp", "type"].includes(key))
              .map((key) => [key, report[key]])
          ),
        };

        parsedStats.stats[report.type].push(reportData);
      });

      return parsedStats;
    } catch (error) {
      console.error(`WebRTC [${this.#username}]: Error getting stats:`, error);
      return null;
    }
  }

  startStatsCollection(callback, intervalMs) {
    if (this.#isStatsCollectionActive) {
      console.warn(
        `WebRTC [${this.#username}]: Stats collection already active`
      );
      return;
    }

    if (!this.#peerConnection) {
      console.warn(
        `WebRTC [${
          this.#username
        }]: Cannot start stats collection - no peer connection`
      );
      return;
    }

    const interval = intervalMs || 5000;
    this.#statsCallback = callback;
    this.#isStatsCollectionActive = true;

    console.log(
      `WebRTC [${
        this.#username
      }]: Starting stats collection every ${interval}ms`
    );

    this.#statsInterval = setInterval(async () => {
      if (!this.#isStatsCollectionActive || !this.#peerConnection) {
        return;
      }

      const stats = await this.getStats();
      if (stats && this.#statsCallback) {
        try {
          this.#statsCallback(stats);
        } catch (error) {
          console.error(
            `WebRTC [${this.#username}]: Error in stats callback:`,
            error
          );
        }
      }
    }, interval);
  }

  /**
   * Stop periodic stats collection
   */
  stopStatsCollection() {
    if (!this.#isStatsCollectionActive) {
      return;
    }

    console.log(`WebRTC [${this.#username}]: Stopping stats collection`);

    if (this.#statsInterval) {
      clearInterval(this.#statsInterval);
      this.#statsInterval = null;
    }

    this.#isStatsCollectionActive = false;
    this.#statsCallback = null;
  }

  /**
   * Set stats callback for periodic updates
   * @param {Function} callback - Callback function to receive stats data
   */
  setStatsCallback(callback) {
    this.#statsCallback = callback;
  }

  /**
   * Parse key call quality metrics from WebRTC stats
   * @param {Object} stats - Raw stats object from getStats()
   * @returns {Object} Parsed call quality metrics
   */
  parseCallQualityStats(stats) {
    if (!stats || !stats.stats) {
      return null;
    }

    const quality = {
      timestamp: stats.timestamp,
      connectionState: stats.connectionState,
      iceConnectionState: stats.iceConnectionState,

      // Video metrics
      video: {
        fps: { incoming: 0, outgoing: 0 },
        resolution: {
          incoming: { width: 0, height: 0 },
          outgoing: { width: 0, height: 0 },
        },
        bitrate: { incoming: 0, outgoing: 0 },
        packetsLost: { incoming: 0, outgoing: 0 },
        packetsReceived: { incoming: 0, outgoing: 0 },
        packetsSent: { incoming: 0, outgoing: 0 },
        jitter: { incoming: 0, outgoing: 0 },
        roundTripTime: 0,
      },

      // Audio metrics
      audio: {
        bitrate: { incoming: 0, outgoing: 0 },
        packetsLost: { incoming: 0, outgoing: 0 },
        packetsReceived: { incoming: 0, outgoing: 0 },
        packetsSent: { incoming: 0, outgoing: 0 },
        jitter: { incoming: 0, outgoing: 0 },
        audioLevel: { incoming: 0, outgoing: 0 },
      },

      // Network metrics
      network: {
        roundTripTime: 0,
        availableOutgoingBitrate: 0,
        availableIncomingBitrate: 0,
        totalBytesReceived: 0,
        totalBytesSent: 0,
      },
    };

    // Parse inbound RTP stats (incoming media)
    if (stats.stats["inbound-rtp"]) {
      stats.stats["inbound-rtp"].forEach((report) => {
        if (report.mediaType === "video") {
          quality.video.fps.incoming = report.framesPerSecond || 0;
          quality.video.resolution.incoming = {
            width: report.frameWidth || 0,
            height: report.frameHeight || 0,
          };
          quality.video.bitrate.incoming =
            (report.bytesReceived * 8) / 1000 || 0; // kbps
          quality.video.packetsLost.incoming = report.packetsLost || 0;
          quality.video.packetsReceived.incoming = report.packetsReceived || 0;
          quality.video.jitter.incoming = report.jitter || 0;
        } else if (report.mediaType === "audio") {
          quality.audio.bitrate.incoming =
            (report.bytesReceived * 8) / 1000 || 0; // kbps
          quality.audio.packetsLost.incoming = report.packetsLost || 0;
          quality.audio.packetsReceived.incoming = report.packetsReceived || 0;
          quality.audio.jitter.incoming = report.jitter || 0;
          quality.audio.audioLevel.incoming = report.audioLevel || 0;
        }
      });
    }

    // Parse outbound RTP stats (outgoing media)
    if (stats.stats["outbound-rtp"]) {
      stats.stats["outbound-rtp"].forEach((report) => {
        if (report.mediaType === "video") {
          quality.video.fps.outgoing = report.framesPerSecond || 0;
          quality.video.resolution.outgoing = {
            width: report.frameWidth || 0,
            height: report.frameHeight || 0,
          };
          quality.video.bitrate.outgoing = (report.bytesSent * 8) / 1000 || 0; // kbps
          quality.video.packetsLost.outgoing = report.packetsLost || 0;
          quality.video.packetsSent.outgoing = report.packetsSent || 0;
        } else if (report.mediaType === "audio") {
          quality.audio.bitrate.outgoing = (report.bytesSent * 8) / 1000 || 0; // kbps
          quality.audio.packetsLost.outgoing = report.packetsLost || 0;
          quality.audio.packetsSent.outgoing = report.packetsSent || 0;
          quality.audio.audioLevel.outgoing = report.audioLevel || 0;
        }
      });
    }

    // Parse candidate pair stats (network quality)
    if (stats.stats["candidate-pair"]) {
      stats.stats["candidate-pair"].forEach((report) => {
        if (report.state === "succeeded") {
          quality.network.roundTripTime =
            report.currentRoundTripTime * 1000 || 0; // ms
          quality.network.availableOutgoingBitrate =
            report.availableOutgoingBitrate || 0;
          quality.network.availableIncomingBitrate =
            report.availableIncomingBitrate || 0;
          quality.network.totalBytesReceived = report.bytesReceived || 0;
          quality.network.totalBytesSent = report.bytesSent || 0;
        }
      });
    }

    // Calculate packet loss percentages
    if (quality.video.packetsReceived.incoming > 0) {
      quality.video.packetLossPercentage = {
        incoming:
          (quality.video.packetsLost.incoming /
            (quality.video.packetsReceived.incoming +
              quality.video.packetsLost.incoming)) *
          100,
        outgoing:
          quality.video.packetsLost.outgoing > 0
            ? (quality.video.packetsLost.outgoing /
                (quality.video.packetsSent.outgoing +
                  quality.video.packetsLost.outgoing)) *
              100
            : 0,
      };
    }

    if (quality.audio.packetsReceived.incoming > 0) {
      quality.audio.packetLossPercentage = {
        incoming:
          (quality.audio.packetsLost.incoming /
            (quality.audio.packetsReceived.incoming +
              quality.audio.packetsLost.incoming)) *
          100,
        outgoing:
          quality.audio.packetsLost.outgoing > 0
            ? (quality.audio.packetsLost.outgoing /
                (quality.audio.packetsSent.outgoing +
                  quality.audio.packetsLost.outgoing)) *
              100
            : 0,
      };
    }

    return quality;
  }

  logCallQualityStats(stats) {
    const quality = this.parseCallQualityStats(stats);
    if (quality) {
      console.log("=== CALL QUALITY METRICS ===");
      console.log(
        `Connection: ${quality.connectionState} | ICE: ${quality.iceConnectionState}`
      );
      console.log(`Ping: ${quality.network.roundTripTime.toFixed(1)}ms`);
      console.log(
        `Video FPS: In=${quality.video.fps.incoming} Out=${quality.video.fps.outgoing}`
      );
      console.log(
        `Video Resolution: In=${quality.video.resolution.incoming.width}x${quality.video.resolution.incoming.height} Out=${quality.video.resolution.outgoing.width}x${quality.video.resolution.outgoing.height}`
      );
      console.log(
        `Video Bitrate: In=${quality.video.bitrate.incoming.toFixed(
          1
        )}kbps Out=${quality.video.bitrate.outgoing.toFixed(1)}kbps`
      );
      console.log(
        `Video Packet Loss: In=${
          quality.video.packetLossPercentage?.incoming?.toFixed(2) || 0
        }% Out=${
          quality.video.packetLossPercentage?.outgoing?.toFixed(2) || 0
        }%`
      );
      console.log(
        `Audio Bitrate: In=${quality.audio.bitrate.incoming.toFixed(
          1
        )}kbps Out=${quality.audio.bitrate.outgoing.toFixed(1)}kbps`
      );
      console.log(
        `Audio Packet Loss: In=${
          quality.audio.packetLossPercentage?.incoming?.toFixed(2) || 0
        }% Out=${
          quality.audio.packetLossPercentage?.outgoing?.toFixed(2) || 0
        }%`
      );
      console.log(
        `Audio Level: In=${quality.audio.audioLevel.incoming.toFixed(
          2
        )} Out=${quality.audio.audioLevel.outgoing.toFixed(2)}`
      );
      console.log(
        `Jitter: Video=${quality.video.jitter.incoming.toFixed(
          3
        )}ms Audio=${quality.audio.jitter.incoming.toFixed(3)}ms`
      );
      console.log("==========================");
    }
  }

  toggleAudio() {
    if (this.#localStream) {
      this.#localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  }

  toggleVideo() {
    if (this.#localStream) {
      this.#localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
    }
  }

  toggleFlipCamera() {
    if (this.#localStream) {
      this.#localStream.getVideoTracks().forEach((track) => {
        track._switchCamera();
      });
    }
  }
}

export default WebRTCService;
