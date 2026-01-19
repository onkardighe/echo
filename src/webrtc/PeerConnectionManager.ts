import { PeerConnectionConfig } from './WebRTC.types';
// Note: This file will be bundled/loaded in the WebView, so it uses DOM APIs (RTCPeerConnection, etc.)

export class PeerConnectionManager {
    private pc: RTCPeerConnection | null = null;
    private localStream: MediaStream | null = null;
    private remoteStream: MediaStream | null = null;

    constructor(
        private config: PeerConnectionConfig,
        private onSignal: (type: 'offer' | 'answer' | 'candidate', payload: string) => void,
        private onTrack: (stream: MediaStream) => void,
        private onConnectionStateChange: (state: RTCPeerConnectionState) => void,
        private onError: (error: string) => void
    ) { }

    public async startCall(): Promise<void> {
        try {
            await this.initializePeerConnection();
            const offer = await this.pc!.createOffer();
            await this.pc!.setLocalDescription(offer);

            // The ICE gathering process will trigger onSignal('candidate')
            // But we typically want to send the offer immediately or wait for all ICE candidates?
            // For manual copy-paste, it's better to wait for gathering complete or trickling?
            // Requirement says "Manual exchange of: SDP Offer... ICE Candidates (optional batch copy)"
            // Simplest approach: Trickle or bundle. 
            // Let's send the offer immediately. 
            // Actually, if we want a single blob to copy, we should wait for iceGatheringState === 'complete'.

            this.onSignal('offer', JSON.stringify(this.pc!.localDescription));
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

            this.onSignal('answer', JSON.stringify(this.pc!.localDescription));
        } catch (err: any) {
            this.onError(`Failed to join call: ${err.message}`);
        }
    }

    public async handleAnswer(answerSdp: string): Promise<void> {
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
                // In a real automated signaling app, we'd send this immediately.
                // For manual copy-paste, maybe we should just print it?
                // Or maybe we depend on the user copying the updated description if we wait?
                // For now, let's emit it so UI can decide (e.g. append to a list).
                this.onSignal('candidate', JSON.stringify(event.candidate));
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
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            this.localStream.getTracks().forEach(track => {
                this.pc!.addTrack(track, this.localStream!);
            });
        } catch (err: any) {
            this.onError(`Could not access microphone: ${err.message}`);
            throw err;
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
