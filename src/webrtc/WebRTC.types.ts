export interface PeerConnectionConfig {
    iceServers: RTCIceServer[];
}

export type SignalCallback = (data: { type: 'offer' | 'answer' | 'candidate'; payload: any }) => void;

export interface SignalingData {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}
