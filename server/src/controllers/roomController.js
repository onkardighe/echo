const roomService = require('../services/roomService');
const logger = require('../utils/logger');

const roomController = {
    createRoom: (req, res) => {
        try {
            const roomId = roomService.createRoom();
            res.status(201).json({ roomId });
        } catch (err) {
            logger.error('Error creating room', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    },

    postOffer: (req, res) => {
        const { roomId } = req.params;
        const { sdp } = req.body;

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
        const room = roomService.getRoom(roomId);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.offer) {
            return res.status(404).json({ error: 'Offer not found' });
        }

        res.status(200).json({ sdp: room.offer });
    },

    postAnswer: (req, res) => {
        const { roomId } = req.params;
        const { sdp } = req.body;

        if (!sdp) {
            return res.status(400).json({ error: 'SDP is required' });
        }

        const success = roomService.addAnswer(roomId, sdp);
        if (!success) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.status(200).json({ message: 'Answer stored' });
    },

    getAnswer: (req, res) => {
        const { roomId } = req.params;
        const room = roomService.getRoom(roomId);

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        if (!room.answer) {
            return res.status(404).json({ error: 'Answer not found' });
        }

        res.status(200).json({ sdp: room.answer });
    },

    postIceCandidate: (req, res) => {
        const { roomId } = req.params;
        const { candidate, type } = req.body; // type = 'offer' or 'answer' (who generated it)

        if (!candidate || !type) {
            return res.status(400).json({ error: 'Candidate and type are required' });
        }

        const success = roomService.addCandidate(roomId, candidate, type);
        if (!success) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.status(200).json({ message: 'Candidate stored' });
    },

    getIceCandidates: (req, res) => {
        const { roomId } = req.params;
        // Optional query param to filter? For now, return all.
        const candidates = roomService.getCandidates(roomId);

        // If room doesn't exist, getCandidates returns empty array or we check getRoom
        const room = roomService.getRoom(roomId);
        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        res.status(200).json({ candidates });
    }
};

module.exports = roomController;
