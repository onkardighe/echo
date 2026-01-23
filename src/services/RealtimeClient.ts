/**
 * RealtimeClient - WebSocket client for realtime participant events
 * Uses Socket.io to sync mic state, user presence, and speaking indicators
 */

import { io, Socket } from 'socket.io-client';

export interface Participant {
    odId: string;
    displayName: string;
    isMuted: boolean;
    isSpeaking: boolean;
    joinedAt: number;
}

export interface RealtimeCallbacks {
    onParticipants: (participants: Participant[]) => void;
    onUserJoined: (participant: Participant) => void;
    onUserLeft: (odId: string) => void;
    onUserMicChanged: (odId: string, isMuted: boolean) => void;
    onUserSpeaking: (odId: string, isSpeaking: boolean) => void;
    onError: (message: string) => void;
}

export class RealtimeClient {
    private socket: Socket | null = null;
    private serverUrl: string;
    private callbacks: RealtimeCallbacks | null = null;
    private currentRoomId: string | null = null;
    private currentToken: string | null = null;
    private displayName: string = 'User';

    constructor(serverUrl: string = process.env.API_BASE_URL || 'http://localhost:3000') {
        this.serverUrl = serverUrl;
    }

    /**
     * Set callbacks for realtime events
     */
    setCallbacks(callbacks: RealtimeCallbacks): void {
        this.callbacks = callbacks;
    }

    /**
     * Set display name for this user
     */
    setDisplayName(name: string): void {
        this.displayName = name;
    }

    /**
     * Connect to the WebSocket server
     */
    connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) {
                resolve();
                return;
            }

            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            });

            this.socket.on('connect', () => {
                console.log('[RealtimeClient] Connected to server');
                resolve();
            });

            this.socket.on('connect_error', (error) => {
                console.error('[RealtimeClient] Connection error:', error);
                reject(error);
            });

            // Set up event listeners
            this.setupEventListeners();
        });
    }

    /**
     * Set up Socket.io event listeners
     */
    private setupEventListeners(): void {
        if (!this.socket) return;

        this.socket.on('participants', ({ participants }) => {
            console.log('[RealtimeClient] Received participants:', participants);
            this.callbacks?.onParticipants(participants);
        });

        this.socket.on('user-joined', ({ participant }) => {
            console.log('[RealtimeClient] User joined:', participant);
            this.callbacks?.onUserJoined(participant);
        });

        this.socket.on('user-left', ({ odId }) => {
            console.log('[RealtimeClient] User left:', odId);
            this.callbacks?.onUserLeft(odId);
        });

        this.socket.on('user-mic-changed', ({ odId, isMuted }) => {
            console.log('[RealtimeClient] Mic changed:', odId, isMuted);
            this.callbacks?.onUserMicChanged(odId, isMuted);
        });

        this.socket.on('user-speaking', ({ odId, isSpeaking }) => {
            this.callbacks?.onUserSpeaking(odId, isSpeaking);
        });

        this.socket.on('error', ({ message }) => {
            console.error('[RealtimeClient] Server error:', message);
            this.callbacks?.onError(message);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('[RealtimeClient] Disconnected:', reason);
        });
    }

    /**
     * Join a room with token authentication
     */
    joinRoom(roomId: string, token: string): void {
        if (!this.socket?.connected) {
            console.error('[RealtimeClient] Not connected');
            return;
        }

        this.currentRoomId = roomId;
        this.currentToken = token;

        this.socket.emit('join-room', {
            roomId,
            token,
            displayName: this.displayName
        });
    }

    /**
     * Leave the current room
     */
    leaveRoom(): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('leave-room');
        this.currentRoomId = null;
        this.currentToken = null;
    }

    /**
     * Emit microphone state change
     */
    emitMicState(isMuted: boolean): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('mic-state', { isMuted });
    }

    /**
     * Emit speaking state change
     */
    emitSpeaking(isSpeaking: boolean): void {
        if (!this.socket?.connected || !this.currentRoomId) return;

        this.socket.emit('speaking', { isSpeaking });
    }

    /**
     * Disconnect from the server
     */
    disconnect(): void {
        if (this.socket) {
            this.leaveRoom();
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Check if connected
     */
    isConnected(): boolean {
        return this.socket?.connected || false;
    }
}
