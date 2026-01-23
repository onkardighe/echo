const roomService = require('../services/roomService');
const logger = require('../utils/logger');

const roomController = {
    // List all active rooms (public info only)
    listRooms: (req, res) => {
        const rooms = roomService.listRooms();
        res.status(200).json(rooms);
    },

    createRoom: async (req, res) => {
        try {
            const { name, password } = req.body;
            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            const { roomId, hostToken } = await roomService.createRoom(name, password);
            res.status(201).json({ roomId, token: hostToken });
        } catch (err) {
            logger.error('Error creating room', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    joinRoom: async (req, res) => {
        try {
            const { roomId } = req.params;
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            const result = await roomService.joinRoom(roomId, password);
            if (!result) {
                return res.status(401).json({ error: 'Invalid room ID or password' });
            }

            res.status(200).json({ token: result.token });
        } catch (err) {
            logger.error('Error joining room', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    // Middleware-like validation helper (or just check inside each handler)
    // We'll check inside each handler for simplicity as requested to keep code contained.

    postOffer: (req, res) => {
        const { roomId } = req.params;
        const { sdp } = req.body;
        const token = req.headers['x-room-token'];

        if (!roomService.validateToken(roomId, token)) {
            return res.status(403).json({ error: 'Unauthorized: Invalid token' });
        }

        if (!sdp) {
            return res.status(400).json({ error: 'SDP is required' });
        }

        const success = roomService.addOffer(roomId, sdp);
        if (!success) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.status(200).json({ message: 'Offer stored' });
    },

    getOffer: (req, res) => {
        const { roomId } = req.params;
        const token = req.headers['x-room-token'];

        if (!roomService.validateToken(roomId, token)) {
            return res.status(403).json({ error: 'Unauthorized: Invalid token' });
        }

        const room = roomService.getRoom(roomId);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        if (!room.offer) return res.status(404).json({ error: 'Offer not found' });

        res.status(200).json({ sdp: room.offer });
    },

    postAnswer: (req, res) => {
        const { roomId } = req.params;
        const { sdp } = req.body;
        const token = req.headers['x-room-token'];

        if (!roomService.validateToken(roomId, token)) {
            return res.status(403).json({ error: 'Unauthorized: Invalid token' });
        }

        if (!sdp) return res.status(400).json({ error: 'SDP is required' });

        const success = roomService.addAnswer(roomId, sdp);
        if (!success) return res.status(404).json({ error: 'Room not found' });

        res.status(200).json({ message: 'Answer stored' });
    },

    getAnswer: (req, res) => {
        const { roomId } = req.params;
        const token = req.headers['x-room-token'];

        if (!roomService.validateToken(roomId, token)) {
            return res.status(403).json({ error: 'Unauthorized: Invalid token' });
        }

        const room = roomService.getRoom(roomId);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        if (!room.answer) return res.status(404).json({ error: 'Answer not found' });

        res.status(200).json({ sdp: room.answer });
    },

    postIceCandidate: (req, res) => {
        const { roomId } = req.params;
        const { candidate, type } = req.body;
        const token = req.headers['x-room-token'];

        if (!roomService.validateToken(roomId, token)) {
            return res.status(403).json({ error: 'Unauthorized: Invalid token' });
        }

        if (!candidate || !type) {
            return res.status(400).json({ error: 'Candidate and type are required' });
        }

        const success = roomService.addCandidate(roomId, candidate, type);
        if (!success) return res.status(404).json({ error: 'Room not found' });

        res.status(200).json({ message: 'Candidate stored' });
    },

    getIceCandidates: (req, res) => {
        const { roomId } = req.params;
        const token = req.headers['x-room-token'];

        if (!roomService.validateToken(roomId, token)) {
            return res.status(403).json({ error: 'Unauthorized: Invalid token' });
        }

        const candidates = roomService.getCandidates(roomId);

        // Ensure room exists
        const room = roomService.getRoom(roomId);
        if (!room) return res.status(404).json({ error: 'Room not found' });

        res.status(200).json({ candidates });
    }
};

module.exports = roomController;
