// SignalingClient.ts

export interface RoomInfo {
    id: string;
    name: string;
    createdAt: number;
}

export class SignalingClient {
    private baseUrl: string;
    private authToken: string | null = null;

    constructor(baseUrl: string = (process.env.API_BASE_URL || 'http://localhost:3000') + '/api') {
        this.baseUrl = baseUrl;
    }

    setAuthToken(token: string | null): void {
        this.authToken = token;
    }

    getAuthToken(): string | null {
        return this.authToken;
    }

    private getHeaders(): Record<string, string> {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (this.authToken) {
            headers['x-room-token'] = this.authToken;
        }
        return headers;
    }

    async listRooms(): Promise<RoomInfo[]> {
        const response = await fetch(`${this.baseUrl}/rooms`);
        if (!response.ok) throw new Error('Failed to list rooms');
        return await response.json();
    }

    async createRoom(name: string, password: string): Promise<{ roomId: string; token: string }> {
        const response = await fetch(`${this.baseUrl}/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password }),
        });
        if (!response.ok) throw new Error('Failed to create room');
        const data = await response.json();
        this.authToken = data.token;
        return { roomId: data.roomId, token: data.token };
    }

    async joinRoom(roomId: string, password: string): Promise<{ token: string }> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password }),
        });
        if (response.status === 401) {
            throw new Error('Invalid password');
        }
        if (!response.ok) throw new Error('Failed to join room');
        const data = await response.json();
        this.authToken = data.token;
        return { token: data.token };
    }

    async sendOffer(roomId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/offer`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ sdp }),
        });
        if (!response.ok) throw new Error('Failed to send offer');
    }

    async getOffer(roomId: string): Promise<RTCSessionDescriptionInit> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/offer`, {
            headers: this.getHeaders(),
        });
        if (!response.ok) throw new Error('Failed to get offer');
        const data = await response.json();
        return data.sdp;
    }

    async sendAnswer(roomId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/answer`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ sdp }),
        });
        if (!response.ok) throw new Error('Failed to send answer');
    }

    async getAnswer(roomId: string): Promise<RTCSessionDescriptionInit | null> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/answer`, {
            headers: this.getHeaders(),
        });
        if (response.status === 404) return null; // Not ready yet
        if (!response.ok) throw new Error('Failed to get answer');
        const data = await response.json();
        return data.sdp;
    }

    async sendIceCandidate(roomId: string, candidate: RTCIceCandidate, type: 'offer' | 'answer'): Promise<void> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/ice`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ candidate, type }),
        });
        if (!response.ok) throw new Error('Failed to send ICE candidate');
    }

    async getIceCandidates(roomId: string): Promise<{ type: 'offer' | 'answer', candidate: RTCIceCandidate }[]> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/ice`, {
            headers: this.getHeaders(),
        });
        if (!response.ok) return [];
        const data = await response.json();
        return data.candidates || [];
    }
}
