const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Room management
router.get('/rooms', roomController.listRooms);
router.post('/rooms', roomController.createRoom);
router.post('/rooms/:roomId/join', roomController.joinRoom);

// Signaling - Offer
router.post('/rooms/:roomId/offer', roomController.postOffer);
router.get('/rooms/:roomId/offer', roomController.getOffer);

// Signaling - Answer
router.post('/rooms/:roomId/answer', roomController.postAnswer);
router.get('/rooms/:roomId/answer', roomController.getAnswer);

// Signaling - ICE Candidates
router.post('/rooms/:roomId/ice', roomController.postIceCandidate);
router.get('/rooms/:roomId/ice', roomController.getIceCandidates);

module.exports = router;
