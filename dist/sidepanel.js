// src/webrtc/PeerConnectionManager.ts
var PeerConnectionManager = class {
  constructor(onSignal, onTrack, onConnectionStateChange, onError) {
    this.onSignal = onSignal;
    this.onTrack = onTrack;
    this.onConnectionStateChange = onConnectionStateChange;
    this.onError = onError;
    this.pc = null;
    this.localStream = null;
    this.remoteStream = null;
    this.config = {
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    };
  }
  async startCall() {
    try {
      await this.initializePeerConnection();
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      if (this.pc.iceGatheringState === "complete") {
        this.onSignal(JSON.stringify(this.pc.localDescription));
      } else {
        this.onSignal(JSON.stringify(this.pc.localDescription));
      }
    } catch (err) {
      this.onError(`Failed to start call: ${err.message}`);
    }
  }
  async joinCall(offerSdp) {
    try {
      await this.initializePeerConnection();
      const offer = JSON.parse(offerSdp);
      await this.pc.setRemoteDescription(offer);
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.onSignal(JSON.stringify(this.pc.localDescription));
    } catch (err) {
      console.error(err);
      this.onError(`Failed to join call: ${err.message}`);
    }
  }
  async connectToAnswer(answerSdp) {
    if (!this.pc)
      return;
    try {
      const answer = JSON.parse(answerSdp);
      await this.pc.setRemoteDescription(answer);
    } catch (err) {
      this.onError(`Failed to handle answer: ${err.message}`);
    }
  }
  async initializePeerConnection() {
    this.cleanup();
    this.pc = new RTCPeerConnection(this.config);
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
      }
      if (this.pc && this.pc.localDescription) {
        this.onSignal(JSON.stringify(this.pc.localDescription));
      }
    };
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.onTrack(this.remoteStream);
      }
    };
    this.pc.onconnectionstatechange = () => {
      if (this.pc) {
        this.onConnectionStateChange(this.pc.connectionState);
      }
    };
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.localStream.getTracks().forEach((track) => {
        this.pc.addTrack(track, this.localStream);
      });
    } catch (err) {
      this.onError(`Microphone access failed: ${err.message}`);
      throw err;
    }
  }
  toggleMic(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }
  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream = null;
  }
};

// src/sidepanel.ts
var startBtn = document.getElementById("start-call-btn");
var joinBtn = document.getElementById("join-call-btn");
var connectBtn = document.getElementById("connect-btn");
var copySignalBtn = document.getElementById("copy-signal-btn");
var endCallBtn = document.getElementById("end-call-btn");
var toggleMicBtn = document.getElementById("toggle-mic-btn");
var signalingArea = document.getElementById("signaling-area");
var callPanel = document.getElementById("call-panel");
var setupPanel = document.getElementById("setup-panel");
var localSignalArea = document.getElementById("local-signal");
var remoteSignalArea = document.getElementById("remote-signal");
var statusEl = document.getElementById("connection-status");
var usersList = document.getElementById("connected-users-list");
var pcm = null;
var isMicOn = true;
function initPCM() {
  if (pcm)
    return;
  pcm = new PeerConnectionManager(
    (signal) => {
      localSignalArea.value = signal;
    },
    (stream) => {
      console.log("Got remote stream", stream);
      const audio = new Audio();
      audio.srcObject = stream;
      audio.play().catch((e) => console.error("Error playing audio", e));
      updateUserList(true);
    },
    (state) => {
      statusEl.innerText = state;
      if (state === "connected") {
        showCallPanel();
      } else if (state === "disconnected" || state === "failed" || state === "closed") {
        showSetupPanel();
        updateUserList(false);
      }
    },
    (error) => {
      console.error(error);
      alert("Error: " + error);
    }
  );
}
startBtn.addEventListener("click", async () => {
  initPCM();
  signalingArea.classList.remove("hidden");
  await pcm?.startCall();
  statusEl.innerText = "Generating Offer...";
});
joinBtn.addEventListener("click", async () => {
  initPCM();
  signalingArea.classList.remove("hidden");
  statusEl.innerText = "Waiting for Offer...";
});
connectBtn.addEventListener("click", async () => {
  const remoteSignal = remoteSignalArea.value.trim();
  if (!remoteSignal)
    return alert("Please paste the remote signal first.");
  const isStarter = localSignalArea.value.length > 0;
  if (isStarter) {
    await pcm?.connectToAnswer(remoteSignal);
  } else {
    await pcm?.joinCall(remoteSignal);
  }
});
copySignalBtn.addEventListener("click", () => {
  localSignalArea.select();
  document.execCommand("copy");
  copySignalBtn.innerText = "Copied!";
  setTimeout(() => copySignalBtn.innerText = "Copy", 2e3);
});
endCallBtn.addEventListener("click", () => {
  pcm?.cleanup();
  pcm = null;
  showSetupPanel();
  localSignalArea.value = "";
  remoteSignalArea.value = "";
  updateUserList(false);
  statusEl.innerText = "Disconnected";
});
toggleMicBtn.addEventListener("click", () => {
  isMicOn = !isMicOn;
  pcm?.toggleMic(isMicOn);
  toggleMicBtn.innerText = isMicOn ? "\u{1F3A4} On" : "\u{1F3A4} Off";
  toggleMicBtn.classList.toggle("active", isMicOn);
});
function showCallPanel() {
  setupPanel.classList.add("hidden");
  callPanel.classList.remove("hidden");
}
function showSetupPanel() {
  callPanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
  signalingArea.classList.add("hidden");
}
function updateUserList(connected) {
  if (!connected) {
    usersList.innerHTML = "";
    return;
  }
  usersList.innerHTML = `
        <div class="user-item">
            <span class="user-icon">\u{1F464}</span>
            <span class="user-name">Remote User</span>
            <span class="status-dot online"></span>
        </div>
    `;
}
//# sourceMappingURL=sidepanel.js.map
