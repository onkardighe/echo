
import { PeerConnectionManager } from './webrtc/PeerConnectionManager';
import { SignalingClient, RoomInfo } from './services/SignalingClient';
import { RealtimeClient, Participant } from './services/RealtimeClient';

// UI Elements - Setup Panel
const startBtn = document.getElementById('start-call-btn') as HTMLButtonElement;
const joinBtn = document.getElementById('join-call-btn') as HTMLButtonElement;

// Host Flow Elements
const createRoomArea = document.getElementById('create-room-area') as HTMLDivElement;
const roomNameInput = document.getElementById('room-name-input') as HTMLInputElement;
const roomPasswordInput = document.getElementById('room-password-input') as HTMLInputElement;
const createRoomBtn = document.getElementById('create-room-btn') as HTMLButtonElement;

// Guest Flow Elements
const roomListArea = document.getElementById('room-list-area') as HTMLDivElement;
const roomsList = document.getElementById('rooms-list') as HTMLDivElement;
const refreshRoomsBtn = document.getElementById('refresh-rooms-btn') as HTMLButtonElement;

// Password Modal Elements
const passwordModal = document.getElementById('password-modal') as HTMLDivElement;
const modalRoomName = document.getElementById('modal-room-name') as HTMLParagraphElement;
const modalPasswordInput = document.getElementById('modal-password-input') as HTMLInputElement;
const modalError = document.getElementById('modal-error') as HTMLDivElement;
const modalCancelBtn = document.getElementById('modal-cancel-btn') as HTMLButtonElement;
const modalJoinBtn = document.getElementById('modal-join-btn') as HTMLButtonElement;

// Call Panel Elements
const endCallBtn = document.getElementById('end-call-btn') as HTMLButtonElement;
const toggleMicBtn = document.getElementById('toggle-mic-btn') as HTMLButtonElement;
const callPanel = document.getElementById('call-panel') as HTMLDivElement;
const setupPanel = document.getElementById('setup-panel') as HTMLDivElement;
const statusEl = document.getElementById('connection-status') as HTMLSpanElement;
const usersList = document.getElementById('connected-users-list') as HTMLDivElement;

// Error banner
const errorBanner = document.getElementById('error-banner') as HTMLDivElement;

let pcm: PeerConnectionManager | null = null;
let signalingClient: SignalingClient = new SignalingClient();
let realtimeClient: RealtimeClient = new RealtimeClient();
let isMicOn = true;
let currentRoomId: string | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let currentMetadataType: 'host' | 'guest' | null = null;
let selectedRoomForJoin: RoomInfo | null = null;

// Participant state
let participants: Map<string, Participant> = new Map();
let mySocketId: string | null = null;

// Set up realtime client callbacks
realtimeClient.setCallbacks({
    onParticipants: (newParticipants) => {
        participants.clear();
        newParticipants.forEach(p => participants.set(p.odId, p));
        renderParticipantList();
    },
    onUserJoined: (participant) => {
        participants.set(participant.odId, participant);
        renderParticipantList();
        showToast(`${participant.displayName} joined`);
    },
    onUserLeft: (odId) => {
        const p = participants.get(odId);
        if (p) {
            showToast(`${p.displayName} left`);
        }
        participants.delete(odId);
        renderParticipantList();
    },
    onUserMicChanged: (odId, isMuted) => {
        const p = participants.get(odId);
        if (p) {
            p.isMuted = isMuted;
            renderParticipantList();
        }
    },
    onUserSpeaking: (odId, isSpeaking) => {
        const p = participants.get(odId);
        if (p) {
            p.isSpeaking = isSpeaking;
            renderParticipantList();
        }
    },
    onError: (message) => {
        showError(message);
    }
});

// Initialize PeerConnectionManager
function initPCM() {
    if (pcm) return;

    pcm = new PeerConnectionManager(
        async (desc) => {
            if (!currentRoomId) return;
            try {
                if (desc.type === 'offer') {
                    await signalingClient.sendOffer(currentRoomId, desc);
                    statusEl.innerText = "Waiting for guest...";
                    startPollingForAnswer();
                } else if (desc.type === 'answer') {
                    await signalingClient.sendAnswer(currentRoomId, desc);
                    statusEl.innerText = "Connecting...";
                }
            } catch (err) {
                console.error("Signaling Error:", err);
                statusEl.innerText = "Signaling failed.";
            }
        },
        async (candidate) => {
            if (!currentRoomId || !currentMetadataType) return;
            const type = currentMetadataType === 'host' ? 'offer' : 'answer';
            try {
                await signalingClient.sendIceCandidate(currentRoomId, candidate, type);
            } catch (e) {
                console.warn("Failed to send candidate", e);
            }
        },
        (stream) => {
            console.log('Got remote stream', stream);
            const audio = new Audio();
            audio.srcObject = stream;
            audio.play().catch(e => console.error('Error playing audio', e));
        },
        (state) => {
            statusEl.innerText = state;
            if (state === 'connected') {
                showCallPanel();
                stopPolling();
            } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
                endCall();
            }
        },
        (error: string) => {
            console.error(error);
            showError(error);
        }
    );
}

function requestMicrophonePermission(): Promise<boolean> {
    return new Promise(async (resolve) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(t => t.stop());
            resolve(true);
        } catch (err) {
            console.warn("Mic not granted yet");
            chrome.tabs.create({ url: chrome.runtime.getURL("dist/permissions.html") });
            resolve(false);
        }
    });
}

// Polling Logic
function startPollingForAnswer() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        if (!currentRoomId) return;
        try {
            const answer = await signalingClient.getAnswer(currentRoomId);
            if (answer && pcm) {
                await pcm.connectToAnswer(answer);
                statusEl.innerText = "Answer received! Connecting...";
                stopPolling();
                startPollingForCandidates('answer');
            }
        } catch (e) {
            console.warn("Polling answer error", e);
        }
    }, 2000);
}

function startPollingForCandidates(targetType: 'offer' | 'answer') {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        if (!currentRoomId || !pcm) return;
        try {
            const candidates = await signalingClient.getIceCandidates(currentRoomId);
            for (const c of candidates) {
                if (c.type === targetType) {
                    await pcm.addRemoteCandidate(c.candidate);
                }
            }
        } catch (e) {
            console.warn("Polling candidates error", e);
        }
    }, 2000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

// === HOST FLOW ===
startBtn.addEventListener('click', async () => {
    const granted = await requestMicrophonePermission();
    if (!granted) return;

    // Show create room form
    createRoomArea.classList.remove('hidden');
    roomListArea.classList.add('hidden');
    startBtn.disabled = true;
    joinBtn.disabled = true;
    statusEl.innerText = "Enter room details";
});

createRoomBtn.addEventListener('click', async () => {
    const name = roomNameInput.value.trim() || 'My Room';
    const password = roomPasswordInput.value;

    if (!password) {
        showError('Please enter a password for the room.');
        return;
    }

    try {
        createRoomBtn.disabled = true;
        createRoomBtn.classList.add('loading');
        statusEl.innerText = "Creating Room...";

        const { roomId, token } = await signalingClient.createRoom(name, password);
        currentRoomId = roomId;
        currentMetadataType = 'host';

        // Connect to realtime server
        realtimeClient.setDisplayName('You (Host)');
        await realtimeClient.connect();
        realtimeClient.joinRoom(roomId, token);

        statusEl.innerText = `Room created! Waiting for guest...`;

        initPCM();
        await pcm?.startCall();

    } catch (e) {
        statusEl.innerText = "Failed to create room.";
        console.error(e);
        createRoomBtn.disabled = false;
        createRoomBtn.classList.remove('loading');
    }
});

// === GUEST FLOW ===
joinBtn.addEventListener('click', async () => {
    const granted = await requestMicrophonePermission();
    if (!granted) return;

    // Show room list
    roomListArea.classList.remove('hidden');
    createRoomArea.classList.add('hidden');
    startBtn.disabled = true;
    joinBtn.disabled = true;
    statusEl.innerText = "Loading rooms...";

    await loadRooms();
});

refreshRoomsBtn.addEventListener('click', loadRooms);

async function loadRooms() {
    try {
        refreshRoomsBtn.disabled = true;
        refreshRoomsBtn.classList.add('loading');
        const rooms = await signalingClient.listRooms();
        renderRoomList(rooms);
        statusEl.innerText = rooms.length ? "Select a room to join" : "No active rooms";
    } catch (e) {
        console.error("Failed to load rooms", e);
        statusEl.innerText = "Failed to load rooms";
        roomsList.innerHTML = '<div class="empty-state"><span class="empty-icon">📡</span><p>Server unavailable</p></div>';
    } finally {
        refreshRoomsBtn.disabled = false;
        refreshRoomsBtn.classList.remove('loading');
    }
}

function renderRoomList(rooms: RoomInfo[]) {
    if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="empty-state"><span class="empty-icon">🔇</span><p>No active rooms</p><p class="empty-hint">Create an Echo to get started</p></div>';
        return;
    }

    roomsList.innerHTML = rooms.map(room => `
        <div class="room-item" data-room-id="${room.id}" data-room-name="${room.name}">
            <div class="room-info">
                <span class="room-name">${escapeHtml(room.name)}</span>
                <span class="room-time">${formatTime(room.createdAt)}</span>
            </div>
            <svg class="room-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 18l6-6-6-6"/>
            </svg>
        </div>
    `).join('');

    // Add click handlers
    roomsList.querySelectorAll('.room-item').forEach(item => {
        item.addEventListener('click', () => {
            const roomId = item.getAttribute('data-room-id')!;
            const roomName = item.getAttribute('data-room-name')!;
            showPasswordModal(roomId, roomName);
        });
    });
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// === PASSWORD MODAL ===
function showPasswordModal(roomId: string, roomName: string) {
    selectedRoomForJoin = { id: roomId, name: roomName, createdAt: 0 };
    modalRoomName.textContent = `Joining: ${roomName}`;
    modalPasswordInput.value = '';
    modalError.classList.add('hidden');
    passwordModal.classList.remove('hidden');
    passwordModal.classList.add('modal-enter');
    modalPasswordInput.focus();
}

function hidePasswordModal() {
    passwordModal.classList.add('modal-exit');
    setTimeout(() => {
        passwordModal.classList.add('hidden');
        passwordModal.classList.remove('modal-enter', 'modal-exit');
    }, 200);
    selectedRoomForJoin = null;
}

modalCancelBtn.addEventListener('click', () => {
    hidePasswordModal();
});

modalJoinBtn.addEventListener('click', async () => {
    if (!selectedRoomForJoin) return;

    const password = modalPasswordInput.value;
    if (!password) {
        modalError.textContent = 'Please enter a password';
        modalError.classList.remove('hidden');
        return;
    }

    try {
        modalJoinBtn.disabled = true;
        modalJoinBtn.classList.add('loading');
        modalError.classList.add('hidden');

        const { token } = await signalingClient.joinRoom(selectedRoomForJoin.id, password);
        currentRoomId = selectedRoomForJoin.id;
        currentMetadataType = 'guest';

        // Connect to realtime server
        realtimeClient.setDisplayName('You (Guest)');
        await realtimeClient.connect();
        realtimeClient.joinRoom(currentRoomId, token);

        hidePasswordModal();
        statusEl.innerText = "Joining...";

        const offer = await signalingClient.getOffer(currentRoomId);
        initPCM();
        await pcm?.joinCall(offer);

        startPollingForCandidates('offer');

    } catch (e: any) {
        modalJoinBtn.disabled = false;
        modalJoinBtn.classList.remove('loading');
        if (e.message === 'Invalid password') {
            modalError.textContent = 'Wrong password. Try again.';
        } else {
            modalError.textContent = 'Failed to join room.';
        }
        modalError.classList.remove('hidden');
        console.error(e);
    }
});

// Enter key in modal
modalPasswordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        modalJoinBtn.click();
    }
});

// === CALL MANAGEMENT ===
function endCall() {
    stopPolling();
    pcm?.cleanup();
    pcm = null;
    realtimeClient.disconnect();
    participants.clear();
    currentRoomId = null;
    currentMetadataType = null;
    signalingClient.setAuthToken(null);
    showSetupPanel();
    roomNameInput.value = '';
    roomPasswordInput.value = '';
    renderParticipantList();
    statusEl.innerText = 'Disconnected';
}

endCallBtn.addEventListener('click', endCall);

toggleMicBtn.addEventListener('click', () => {
    isMicOn = !isMicOn;
    pcm?.toggleMic(isMicOn);

    // Update button UI
    const micIcon = toggleMicBtn.querySelector('.mic-icon');
    const micLabel = toggleMicBtn.querySelector('.mic-label');
    if (micIcon && micLabel) {
        micIcon.innerHTML = isMicOn ? getMicOnIcon() : getMicOffIcon();
        micLabel.textContent = isMicOn ? 'Mute' : 'Unmute';
    }
    toggleMicBtn.classList.toggle('muted', !isMicOn);

    // Emit mic state to server
    realtimeClient.emitMicState(!isMicOn);
});

// UI Helpers
function showCallPanel() {
    setupPanel.classList.add('hidden');
    callPanel.classList.remove('hidden');
    callPanel.classList.add('panel-enter');
}

function showSetupPanel() {
    callPanel.classList.add('hidden');
    callPanel.classList.remove('panel-enter');
    setupPanel.classList.remove('hidden');
    createRoomArea.classList.add('hidden');
    roomListArea.classList.add('hidden');
    startBtn.disabled = false;
    joinBtn.disabled = false;
    createRoomBtn.disabled = false;
    createRoomBtn.classList.remove('loading');
    modalJoinBtn.disabled = false;
    modalJoinBtn.classList.remove('loading');
}

function renderParticipantList() {
    if (participants.size === 0) {
        usersList.innerHTML = '<div class="empty-state small"><p>Waiting for participants...</p></div>';
        return;
    }

    usersList.innerHTML = Array.from(participants.values()).map(p => `
        <div class="user-item ${p.isSpeaking ? 'speaking' : ''}" data-id="${p.odId}">
            <div class="user-avatar">
                ${getUserIcon()}
            </div>
            <span class="user-name">${escapeHtml(p.displayName)}</span>
            <div class="user-status">
                ${p.isMuted ? getMicOffIcon() : ''}
                <span class="status-dot ${getStatusClass(p)}"></span>
            </div>
        </div>
    `).join('');
}

function getStatusClass(p: Participant): string {
    if (p.isSpeaking) return 'speaking';
    if (p.isMuted) return 'muted';
    return 'online';
}

// Toast notification
function showToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// Error handling
function showError(message: string) {
    if (errorBanner) {
        errorBanner.textContent = message;
        errorBanner.classList.remove('hidden');
        setTimeout(() => {
            errorBanner.classList.add('hidden');
        }, 5000);
    }
}

// SVG Icons
function getMicOnIcon(): string {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>`;
}

function getMicOffIcon(): string {
    return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="1" y1="1" x2="23" y2="23"/>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>`;
}

function getUserIcon(): string {
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
    </svg>`;
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    realtimeClient.disconnect();
    pcm?.cleanup();
});

// Handle visibility change for cleanup
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && currentRoomId) {
        // Optionally handle visibility changes
    }
});
