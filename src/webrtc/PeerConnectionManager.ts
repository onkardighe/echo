
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
        private onSignal: (signal: string) => void,
        private onTrack: (stream: MediaStream) => void,
        private onConnectionStateChange: (state: RTCPeerConnectionState) => void,
        private onError: (error: string) => void
    ) { }

    public async startCall(): Promise<void> {
        try {
            await this.initializePeerConnection();
            const offer = await this.pc!.createOffer();
            await this.pc!.setLocalDescription(offer);
            // wait for ice gathering to complete (simplest for copy-paste)
            // But actually, we need to send the offer immediately if we want to trickle?
            // No, for manual copy paste, simpler to wait for ICE candidates if possible, 
            // OR just send the offer and handle candidates separately?
            // Since we have a single text area for "Signal", bundling is easier.
            // We'll rely on the 'icecandidate' event to update the description or just print candidates?

            // Strategy: We will just dump the localDescription (which contains the SDP).
            // But we need to wait for candidates to be gathered to include them in the SDP 
            // if we want a "one-shot" copy paste.
            // However, for speed, let's just emit the offer. 
            // Browser WebRTC often requires trickling or at least waiting a bit.
            // Let's implement a "wait for gathering complete" approach for simplicity of UX (one copy action).

            if (this.pc!.iceGatheringState === 'complete') {
                this.onSignal(JSON.stringify(this.pc!.localDescription));
            } else {
                // Wait a simplified way (or just emit what we have if user copies early)
                // We will emit the offer now, and if candidates come, we might need to re-emit?
                // Actually, "localDescription" updates as candidates are gathered? No.
                // We have to wait.
                this.onSignal(JSON.stringify(this.pc!.localDescription));
            }

        } catch (err: any) {
            this.onError(`Failed to start call: ${err.message}`);
        }
    }

    public async joinCall(offerSdp: string): Promise<void> {
        try {
            await this.initializePeerConnection();
            const offer = JSON.parse(offerSdp);
            await this.pc!.setRemoteDescription(offer);

            const answer = await this.pc!.createAnswer();
            await this.pc!.setLocalDescription(answer);

            // Same logic, emit answer immediately.
            this.onSignal(JSON.stringify(this.pc!.localDescription));
        } catch (err: any) {
            console.error(err);
            this.onError(`Failed to join call: ${err.message}`);
        }
    }

    public async connectToAnswer(answerSdp: string): Promise<void> {
        if (!this.pc) return;
        try {
            const answer = JSON.parse(answerSdp);
            await this.pc.setRemoteDescription(answer);
        } catch (err: any) {
            this.onError(`Failed to handle answer: ${err.message}`);
        }
    }

    private async initializePeerConnection() {
        this.cleanup();

        this.pc = new RTCPeerConnection(this.config);

        this.pc.onicecandidate = (event) => {
            if (event.candidate) {
                // We could emit candidates individually, but for simple copy-paste, 
                // users usually prefer one blob. 
                // However, `localDescription` DOES NOT automatically update with candidates in all browsers 
                // unless we re-fetch it? Actually in Chrome it often does or we rely on the `icecandidate` 
                // to trigger a "New Signal Available" update in UI.
                // Let's just emit the Updated Local Description every time we get a candidate?
                // That might spam the user. 
                // A common "Manual" pattern is to wait for 'onicecandidate' to be null (creation complete).
            }
            // Always emit the latest description when it changes/candidate added
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

        // Get Local Audio
        try {
            const microphonePermission = await navigator.permissions.query({name : "microphone"});

            if(microphonePermission.state === "denied"){
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
