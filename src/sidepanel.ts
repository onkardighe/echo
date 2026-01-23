
import { PeerConnectionManager } from './webrtc/PeerConnectionManager';
import { SignalingClient, RoomInfo } from './services/SignalingClient';

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

let pcm: PeerConnectionManager | null = null;
let signalingClient: SignalingClient = new SignalingClient();
let isMicOn = true;
let currentRoomId: string | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let currentMetadataType: 'host' | 'guest' | null = null;
let selectedRoomForJoin: RoomInfo | null = null;

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
            updateUserList(true);
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
            alert('Error: ' + error);
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
        alert('Please enter a password for the room.');
        return;
    }

    try {
        createRoomBtn.disabled = true;
        statusEl.innerText = "Creating Room...";

        const { roomId, token } = await signalingClient.createRoom(name, password);
        currentRoomId = roomId;
        currentMetadataType = 'host';

        statusEl.innerText = `Room created! Waiting for guest...`;

        initPCM();
        await pcm?.startCall();

    } catch (e) {
        statusEl.innerText = "Failed to create room.";
        console.error(e);
        createRoomBtn.disabled = false;
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
        const rooms = await signalingClient.listRooms();
        renderRoomList(rooms);
        statusEl.innerText = rooms.length ? "Select a room to join" : "No active rooms";
    } catch (e) {
        console.error("Failed to load rooms", e);
        statusEl.innerText = "Failed to load rooms";
        roomsList.innerHTML = '<div class="empty-list">Server unavailable</div>';
    }
}

function renderRoomList(rooms: RoomInfo[]) {
    if (rooms.length === 0) {
        roomsList.innerHTML = '<div class="empty-list">No active rooms</div>';
        return;
    }

    roomsList.innerHTML = rooms.map(room => `
        <div class="room-item" data-room-id="${room.id}" data-room-name="${room.name}">
            <span class="room-name">${escapeHtml(room.name)}</span>
            <span class="room-time">${formatTime(room.createdAt)}</span>
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
    modalPasswordInput.focus();
}

function hidePasswordModal() {
    passwordModal.classList.add('hidden');
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
        modalError.classList.add('hidden');

        await signalingClient.joinRoom(selectedRoomForJoin.id, password);
        currentRoomId = selectedRoomForJoin.id;
        currentMetadataType = 'guest';

        hidePasswordModal();
        statusEl.innerText = "Joining...";

        const offer = await signalingClient.getOffer(currentRoomId);
        initPCM();
        await pcm?.joinCall(offer);

        startPollingForCandidates('offer');

    } catch (e: any) {
        modalJoinBtn.disabled = false;
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
    currentRoomId = null;
    currentMetadataType = null;
    signalingClient.setAuthToken(null);
    showSetupPanel();
    roomNameInput.value = '';
    roomPasswordInput.value = '';
    updateUserList(false);
    statusEl.innerText = 'Disconnected';
}

endCallBtn.addEventListener('click', endCall);

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
    createRoomArea.classList.add('hidden');
    roomListArea.classList.add('hidden');
    startBtn.disabled = false;
    joinBtn.disabled = false;
    createRoomBtn.disabled = false;
    modalJoinBtn.disabled = false;
}

function updateUserList(connected: boolean) {
    if (!connected) {
        usersList.innerHTML = '';
        return;
    }
    usersList.innerHTML = `
        <div class="user-item">
            <span class="user-icon">👤</span>
            <span class="user-name">Remote User</span>
            <span class="status-dot online"></span>
        </div>
    `;
}
