import { PeerConnectionManager } from '../webrtc/PeerConnectionManager';
import { WebviewToExtensionMessage } from '../messaging/WebviewMessage';
import { ExtensionToWebviewMessage } from '../messaging/ExtensionMessage';

// Ensure we use the global declaration
const vscode = window.acquireVsCodeApi();

class AudioCallApp {
    private pcManager: PeerConnectionManager;

    // UI Elements
    private statusEl = document.getElementById('status')!;
    private startSection = document.getElementById('start-section')!;
    private joinSection = document.getElementById('join-section')!;
    private activeSection = document.getElementById('active-call-section')!;
    private sdpSection = document.getElementById('sdp-display-section')!;
    private localSdpOutput = document.getElementById('local-sdp-output') as HTMLTextAreaElement;
    private remoteSdpInput = document.getElementById('remote-sdp-input') as HTMLTextAreaElement;
    private errorEl = document.getElementById('error-message')!;

    // Buttons
    private btnStart = document.getElementById('btn-start')!;
    private btnJoin = document.getElementById('btn-join')!;
    private btnEnd = document.getElementById('btn-end')!;
    private btnCopy = document.getElementById('btn-copy')!;

    constructor() {
        this.pcManager = new PeerConnectionManager(
            { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
            (type, payload) => this.handleSignal(type, payload),
            (stream) => this.handleTrack(stream),
            (state) => this.updateStatus(state),
            (error) => this.showError(error)
        );

        this.bindEvents();
        window.addEventListener('message', event => {
            const message = event.data as ExtensionToWebviewMessage;
            this.handleMessage(message);
        });
    }

    private bindEvents() {
        this.btnStart.onclick = async () => {
            await this.pcManager.startCall();
            this.showSection('sdp');
            this.updateStatus('Gathering Candidates...');
            this.sendMessage({ type: 'START_CALL' });
        };

        this.btnJoin.onclick = async () => {
            const remoteSdp = this.remoteSdpInput.value.trim();
            if (!remoteSdp) {
                this.showError('Please paste the remote SDP first.');
                return;
            }

            await this.pcManager.joinCall(remoteSdp);
            this.showSection('sdp'); // Show Answer
            this.sendMessage({ type: 'JOIN_CALL', sdp: remoteSdp });
        };

        this.btnCopy.onclick = () => {
            const text = this.localSdpOutput.value;
            this.sendMessage({ type: 'COPY_TO_CLIPBOARD', text });
            this.btnCopy.textContent = 'Copied!';
            setTimeout(() => this.btnCopy.textContent = 'Copy to Clipboard', 2000);
        };

        this.btnEnd.onclick = () => {
            this.pcManager.cleanup();
            this.sendMessage({ type: 'END_CALL' });
            this.resetUI();
        };
    }

    private handleSignal(type: 'offer' | 'answer' | 'candidate', payload: string) {
        if (type === 'offer' || type === 'answer') {
            this.localSdpOutput.value = payload;
            if (type === 'offer') {
                this.remoteSdpInput.placeholder = "Paste the Answer from user here...";
                this.btnJoin.innerText = "Complete Connection";
                this.joinSection.classList.remove('hidden');
                this.btnJoin.onclick = async () => {
                    const answer = this.remoteSdpInput.value.trim();
                    if (answer) {
                        await this.pcManager.handleAnswer(answer);
                    }
                };
            }
        } else if (type === 'candidate') {
            const sdp = JSON.stringify(this.pcManager['pc']?.localDescription);
            if (sdp) this.localSdpOutput.value = sdp;
        }
    }

    private handleTrack(stream: MediaStream) {
        let audio = document.querySelector('audio');
        if (!audio) {
            audio = document.createElement('audio');
            audio.autoplay = true;
            document.body.appendChild(audio);
        }
        audio.srcObject = stream;
    }

    private updateStatus(state: string) {
        this.statusEl.textContent = state;
        if (state === 'connected') {
            this.showSection('active');
        }
    }

    private showError(msg: string) {
        this.errorEl.textContent = msg;
        this.errorEl.classList.remove('hidden');
    }

    private handleMessage(msg: ExtensionToWebviewMessage) {
        // Logic to handle messages from Extension if any
        console.log('Received from extension:', msg);
    }

    private sendMessage(msg: WebviewToExtensionMessage) {
        vscode.postMessage(msg);
    }

    private showSection(section: 'sdp' | 'active') {
        if (section === 'sdp') {
            this.sdpSection.classList.remove('hidden');
        } else if (section === 'active') {
            this.activeSection.classList.remove('hidden');
            this.startSection.classList.add('hidden');
            this.joinSection.classList.add('hidden');
            this.sdpSection.classList.add('hidden');
        }
    }

    private resetUI() {
        this.statusEl.textContent = 'Idle';
        this.startSection.classList.remove('hidden');
        this.joinSection.classList.remove('hidden');
        this.activeSection.classList.add('hidden');
        this.sdpSection.classList.add('hidden');
        this.localSdpOutput.value = '';
        this.remoteSdpInput.value = '';
        this.bindEvents();
    }
}

new AudioCallApp();
