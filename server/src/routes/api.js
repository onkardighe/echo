const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

// Room creation
router.post('/rooms', roomController.createRoom);

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
