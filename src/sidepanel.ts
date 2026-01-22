
import { PeerConnectionManager } from './webrtc/PeerConnectionManager';

// UI Elements
const startBtn = document.getElementById('start-call-btn') as HTMLButtonElement;
const joinBtn = document.getElementById('join-call-btn') as HTMLButtonElement;
const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
const copySignalBtn = document.getElementById('copy-signal-btn') as HTMLButtonElement;
const endCallBtn = document.getElementById('end-call-btn') as HTMLButtonElement;
const toggleMicBtn = document.getElementById('toggle-mic-btn') as HTMLButtonElement;

const signalingArea = document.getElementById('signaling-area') as HTMLDivElement;
const callPanel = document.getElementById('call-panel') as HTMLDivElement;
const setupPanel = document.getElementById('setup-panel') as HTMLDivElement;
const localSignalArea = document.getElementById('local-signal') as HTMLTextAreaElement;
const remoteSignalArea = document.getElementById('remote-signal') as HTMLTextAreaElement;
const statusEl = document.getElementById('connection-status') as HTMLSpanElement;
const usersList = document.getElementById('connected-users-list') as HTMLDivElement;

let pcm: PeerConnectionManager | null = null;
let isMicOn = true;

// Initialize PeerConnectionManager
function initPCM() {
    if (pcm) return;

    pcm = new PeerConnectionManager(
        (signal) => {
            localSignalArea.value = signal;
        },
        (stream) => {
            console.log('Got remote stream', stream);
            // In a side panel, we can play audio directly.
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play().catch(e => console.error('Error playing audio', e));

            updateUserList(true);
        },
        (state) => {
            statusEl.innerText = state;
            if (state === 'connected') {
                showCallPanel();
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                showSetupPanel();
                updateUserList(false);
            }
        },
        (error: string) => {
            console.error(error);
            if (error.includes('Permission dismissed') || error.includes('Permission denied') || error.includes('Microphone permission denied')) {
                // Show a manual permission button
                statusEl.innerHTML = `
                    Microphone access needed. 
                    <button id="grant-perm-btn" style="background:#0e639c;color:white;border:none;padding:5px;cursor:pointer;">
                        Grant Permission
                    </button>
                `;
                document.getElementById('grant-perm-btn')?.addEventListener('click', () => {
                    chrome.tabs.create({ url: chrome.runtime.getURL('dist/permissions.html') });
                });
            } else {
                alert('Error: ' + error);
            }
        }
    );
}

// Event Listeners
startBtn.addEventListener('click', async () => {
    initPCM();
    signalingArea.classList.remove('hidden');
    await pcm?.startCall();
    statusEl.innerText = "Generating Offer...";
});

joinBtn.addEventListener('click', async () => {
    initPCM();
    signalingArea.classList.remove('hidden');
    statusEl.innerText = "Waiting for Offer...";
});

connectBtn.addEventListener('click', async () => {
    const remoteSignal = remoteSignalArea.value.trim();
    if (!remoteSignal) return alert('Please paste the remote signal first.');

    // Determine if we are joining (have no local signal yet) or answering (already have local signal)
    // Actually, "Join" flow: user clicks Join -> Pastes Offer -> Connect -> Generates Answer
    // "Start" flow: User clicks Start -> Generates Offer -> Waiting -> Pastes Answer -> Connect

    // Simple heuristic: If we have a local signal already, we are likely the "Starter" processing an Answer.
    // If we don't, we are the "Joiner" processing an Offer.

    const isStarter = localSignalArea.value.length > 0;

    if (isStarter) {
        // We are processing an Answer
        await pcm?.connectToAnswer(remoteSignal);
    } else {
        // We are processing an Offer
        await pcm?.joinCall(remoteSignal);
    }
});

copySignalBtn.addEventListener('click', () => {
    localSignalArea.select();
    document.execCommand('copy');
    copySignalBtn.innerText = 'Copied!';
    setTimeout(() => copySignalBtn.innerText = 'Copy', 2000);
});

endCallBtn.addEventListener('click', () => {
    pcm?.cleanup();
    pcm = null;
    showSetupPanel();
    localSignalArea.value = '';
    remoteSignalArea.value = '';
    updateUserList(false);
    statusEl.innerText = 'Disconnected';
});

toggleMicBtn.addEventListener('click', () => {
    isMicOn = !isMicOn;
    pcm?.toggleMic(isMicOn);
    toggleMicBtn.innerText = isMicOn ? '🎤 On' : '🎤 Off';
    toggleMicBtn.classList.toggle('active', isMicOn);
});

// UI Helpers
function showCallPanel() {
    setupPanel.classList.add('hidden');
    callPanel.classList.remove('hidden');
}

function showSetupPanel() {
    callPanel.classList.add('hidden');
    setupPanel.classList.remove('hidden');
    signalingArea.classList.add('hidden');
}

function updateUserList(connected: boolean) {
    if (!connected) {
        usersList.innerHTML = '';
        return;
    }
    // Simple single peer display
    usersList.innerHTML = `
        <div class="user-item">
            <span class="user-icon">👤</span>
            <span class="user-name">Remote User</span>
            <span class="status-dot online"></span>
        </div>
    `;
}
