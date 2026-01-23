const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// In-memory store
// Structure:
// {
//   [roomId]: {
//     id: string,
//     name: string,
//     passwordHash: string,
//     hostToken: string,
//     guestToken: string,
//     createdAt: number,
//     lastActive: number,
//     offer: Object | null,
//     answer: Object | null,
//     candidates: Array<{ type: 'offer' | 'answer', candidate: Object }>
//   }
// }
const rooms = {};

const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const ROOM_TTL = 2 * 60 * 60 * 1000; // 2 hours

const roomService = {
    createRoom: async (name, password) => {
        const roomId = uuidv4();
        const hostToken = uuidv4();
        const guestToken = uuidv4();

        const passwordHash = await bcrypt.hash(password, 10);

        rooms[roomId] = {
            id: roomId,
            name: name || 'Untitled Room',
            passwordHash,
            hostToken,
            guestToken,
            createdAt: Date.now(),
            lastActive: Date.now(),
            offer: null,
            answer: null,
            candidates: []
        };

        logger.info(`Room created: ${roomId} ("${name}")`);
        return { roomId, hostToken };
    },

    listRooms: () => {
        return Object.values(rooms).map(room => ({
            id: room.id,
            name: room.name,
            createdAt: room.createdAt,
            // Don't expose passwords or tokens
        })).sort((a, b) => b.createdAt - a.createdAt);
    },

    joinRoom: async (roomId, password) => {
        const room = rooms[roomId];
        if (!room) return null;

        const match = await bcrypt.compare(password, room.passwordHash);
        if (!match) return null;

        room.lastActive = Date.now();
        return { token: room.guestToken };
    },

    // Verify if a token has access to a room
    validateToken: (roomId, token) => {
        const room = rooms[roomId];
        if (!room) return false;

        if (token === room.hostToken || token === room.guestToken) {
            room.lastActive = Date.now();
            return true;
        }
        return false;
    },

    getRoom: (roomId) => {
        return rooms[roomId] || null;
    },

    addOffer: (roomId, offer) => {
        const room = rooms[roomId];
        if (!room) return false;
        room.offer = offer;
        room.lastActive = Date.now();
        logger.info(`Offer added to room: ${roomId}`);
        return true;
    },

    addAnswer: (roomId, answer) => {
        const room = rooms[roomId];
        if (!room) return false;
        room.answer = answer;
        room.lastActive = Date.now();
        logger.info(`Answer added to room: ${roomId}`);
        return true;
    },

    addCandidate: (roomId, candidate, type) => {
        const room = rooms[roomId];
        if (!room) return false;
        room.candidates.push({ type, candidate });
        room.lastActive = Date.now();
        logger.info(`ICE candidate added to room: ${roomId} (${type})`);
        return true;
    },

    getCandidates: (roomId, type) => {
        const room = rooms[roomId];
        if (!room) return [];
        room.lastActive = Date.now();
        return room.candidates;
    },

    cleanupRooms: () => {
        const now = Date.now();
        let cleaned = 0;
        for (const [id, room] of Object.entries(rooms)) {
            if (now - room.lastActive > ROOM_TTL) {
                delete rooms[id];
                cleaned++;
            }
        }
        if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} inactive rooms`);
        }
    }
};

// Start cleanup interval
setInterval(() => roomService.cleanupRooms(), CLEANUP_INTERVAL);

module.exports = roomService;
