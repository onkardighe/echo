const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// In-memory store
// Structure:
// {
//   [roomId]: {
//     id: string,
//     createdAt: number,
//     offer: Object | null,
//     answer: Object | null,
//     candidates: Array<{ type: 'offer' | 'answer', candidate: Object }>
//   }
// }
const rooms = {};

const roomService = {
    createRoom: () => {
        const roomId = uuidv4();
        rooms[roomId] = {
            id: roomId,
            createdAt: Date.now(),
            offer: null,
            answer: null,
            candidates: []
        };
        logger.info(`Room created: ${roomId}`);
        return roomId;
    },

    getRoom: (roomId) => {
        return rooms[roomId] || null;
    },

    addOffer: (roomId, offer) => {
        const room = rooms[roomId];
        if (!room) return false;
        room.offer = offer;
        logger.info(`Offer added to room: ${roomId}`);
        return true;
    },

    addAnswer: (roomId, answer) => {
        const room = rooms[roomId];
        if (!room) return false;
        room.answer = answer;
        logger.info(`Answer added to room: ${roomId}`);
        return true;
    },

    addCandidate: (roomId, candidate, type) => {
        const room = rooms[roomId];
        if (!room) return false;
        // type should be 'offer' (from host) or 'answer' (from guest)
        room.candidates.push({ type, candidate });
        logger.info(`ICE candidate added to room: ${roomId} (${type})`);
        return true;
    },

    getCandidates: (roomId, type) => {
        const room = rooms[roomId];
        if (!room) return [];
        // If I am 'offer' (host), I want candidates from 'answer' (guest) and vice-versa
        // But usually clients just poll everything and filter, or we filter for them.
        // Let's return all for simplicity or filter by who is asking if we knew.
        // For now, let's just return all and let client filter if needed, 
        // OR better: allow client to specify which ones they want.
        // Simplified: return all.
        return room.candidates;
    }
};

module.exports = roomService;
