// SignalingClient.ts
export class SignalingClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:3000/api') {
        this.baseUrl = baseUrl;
    }

    async createRoom(): Promise<string> {
        const response = await fetch(`${this.baseUrl}/rooms`, {
            method: 'POST',
        });
        if (!response.ok) throw new Error('Failed to create room');
        const data = await response.json();
        return data.roomId;
    }

    async sendOffer(roomId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/offer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sdp }),
        });
        if (!response.ok) throw new Error('Failed to send offer');
    }

    async getOffer(roomId: string): Promise<RTCSessionDescriptionInit> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/offer`);
        if (!response.ok) throw new Error('Failed to get offer');
        const data = await response.json();
        return data.sdp;
    }

    async sendAnswer(roomId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/answer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sdp }),
        });
        if (!response.ok) throw new Error('Failed to send answer');
    }

    async getAnswer(roomId: string): Promise<RTCSessionDescriptionInit | null> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/answer`);
        if (response.status === 404) return null; // Not ready yet
        if (!response.ok) throw new Error('Failed to get answer');
        const data = await response.json();
        return data.sdp;
    }

    async sendIceCandidate(roomId: string, candidate: RTCIceCandidate, type: 'offer' | 'answer'): Promise<void> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/ice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate, type }),
        });
        if (!response.ok) throw new Error('Failed to send ICE candidate');
    }

    async getIceCandidates(roomId: string): Promise<{ type: 'offer' | 'answer', candidate: RTCIceCandidate }[]> {
        const response = await fetch(`${this.baseUrl}/rooms/${roomId}/ice`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.candidates || [];
    }
}
