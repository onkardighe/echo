
export interface PeerConnectionConfig {
    iceServers: RTCIceServer[];
}

export class PeerConnectionManager {
    private pc: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;
    private config: PeerConnectionConfig = {
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    };

    constructor(
        private onLocalDescription: (desc: RTCSessionDescriptionInit) => void,
        private onLocalCandidate: (candidate: RTCIceCandidate) => void,
        private onTrack: (stream: MediaStream) => void,
        private onConnectionStateChange: (state: RTCPeerConnectionState) => void,
        private onError: (error: string) => void
    ) { }

    public async startCall(): Promise<void> {
        try {
            await this.initializePeerConnection();
            const offer = await this.pc!.createOffer();
            await this.pc!.setLocalDescription(offer);

            if (this.pc!.localDescription) {
                this.onLocalDescription(this.pc!.localDescription);
            }
        } catch (err: any) {
            this.onError(`Failed to start call: ${err.message}`);
        }
    }

    public async joinCall(offerSdp: RTCSessionDescriptionInit): Promise<void> {
        try {
            await this.initializePeerConnection();
            await this.pc!.setRemoteDescription(offerSdp);

            const answer = await this.pc!.createAnswer();
            await this.pc!.setLocalDescription(answer);

            if (this.pc!.localDescription) {
                this.onLocalDescription(this.pc!.localDescription);
            }
        } catch (err: any) {
            console.error(err);
            this.onError(`Failed to join call: ${err.message}`);
        }
    }

    public async connectToAnswer(answerSdp: RTCSessionDescriptionInit): Promise<void> {
        if (!this.pc) return;
        try {
            await this.pc.setRemoteDescription(answerSdp);
        } catch (err: any) {
            this.onError(`Failed to handle answer: ${err.message}`);
        }
    }

    public async addRemoteCandidate(candidate: RTCIceCandidateInit) {
        if (!this.pc) return;
        try {
            await this.pc.addIceCandidate(candidate);
        } catch (err: any) {
            console.warn(`Failed to add remote candidate: ${err.message}`);
        }
    }

    private async initializePeerConnection() {
        this.cleanup();

        this.pc = new RTCPeerConnection(this.config);

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.onLocalCandidate(event.candidate);
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

        // Get Local Audio
        try {
            const microphonePermission = await navigator.permissions.query({ name: "microphone" as PermissionName });

            if (microphonePermission.state === "denied") {
                this.onError("ECHO : Microphone permission denied !")
                console.error("ECHO ERROR : ", microphonePermission);
            }


            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.localStream.getTracks().forEach(track => {
                this.pc!.addTrack(track, this.localStream!);
            });
        } catch (err: any) {
            this.onError(`Microphone access failed: ${err.message}`);
            throw err;
        }
    }

    public toggleMic(enabled: boolean) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    public cleanup() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        if (this.pc) {
            this.pc.close();
            this.pc = null;
        }
        this.remoteStream = null;
    }
}
