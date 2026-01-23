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
//     candidates: Array<{ type: 'offer' | 'answer', candidate: Object }>,
//     participants: Map<socketId, { displayName, isMuted, isSpeaking, joinedAt }>
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
            candidates: [],
            participants: new Map()
        };

        logger.info(`Room created: ${roomId} ("${name}")`);
        return { roomId, hostToken };
    },

    listRooms: () => {
        return Object.values(rooms).map(room => ({
            id: room.id,
            name: room.name,
            createdAt: room.createdAt,
            participantCount: room.participants ? room.participants.size : 0
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

    // === Participant Management ===

    /**
     * Add a participant to a room
     * @param {string} roomId 
     * @param {string} socketId 
     * @param {Object} data - { displayName, isMuted, isSpeaking }
     * @returns {Object|null} The participant object or null
     */
    addParticipant: (roomId, socketId, data) => {
        const room = rooms[roomId];
        if (!room) return null;

        const participant = {
            odId: socketId,
            displayName: data.displayName || 'User',
            isMuted: data.isMuted || false,
            isSpeaking: data.isSpeaking || false,
            joinedAt: Date.now()
        };

        room.participants.set(socketId, participant);
        room.lastActive = Date.now();
        logger.info(`Participant added to room ${roomId}: ${socketId}`);
        return participant;
    },

    /**
     * Remove a participant from a room
     * @param {string} roomId 
     * @param {string} socketId 
     * @returns {boolean}
     */
    removeParticipant: (roomId, socketId) => {
        const room = rooms[roomId];
        if (!room) return false;

        const deleted = room.participants.delete(socketId);
        if (deleted) {
            room.lastActive = Date.now();
            logger.info(`Participant removed from room ${roomId}: ${socketId}`);
        }
        return deleted;
    },

    /**
     * Update participant state (mic, speaking)
     * @param {string} roomId 
     * @param {string} socketId 
     * @param {Object} updates - { isMuted?, isSpeaking? }
     * @returns {boolean}
     */
    updateParticipantState: (roomId, socketId, updates) => {
        const room = rooms[roomId];
        if (!room) return false;

        const participant = room.participants.get(socketId);
        if (!participant) return false;

        if (typeof updates.isMuted === 'boolean') {
            participant.isMuted = updates.isMuted;
        }
        if (typeof updates.isSpeaking === 'boolean') {
            participant.isSpeaking = updates.isSpeaking;
        }

        room.lastActive = Date.now();
        return true;
    },

    /**
     * Get all participants in a room
     * @param {string} roomId 
     * @returns {Array}
     */
    getParticipants: (roomId) => {
        const room = rooms[roomId];
        if (!room) return [];
        return Array.from(room.participants.values());
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

