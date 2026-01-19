export class IceCandidateStore {
    private candidates: RTCIceCandidateInit[] = [];

    public add(candidate: RTCIceCandidateInit) {
        this.candidates.push(candidate);
    }

    public getAll(): RTCIceCandidateInit[] {
        return [...this.candidates];
    }

    public clear() {
        this.candidates = [];
    }
}
