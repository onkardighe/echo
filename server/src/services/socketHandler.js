/**
 * Socket.io handler for realtime events
 * Manages participant presence and state synchronization
 */

const roomService = require('./roomService');
const logger = require('../utils/logger');

/**
 * Initialize Socket.io event handlers
 * @param {import('socket.io').Server} io - Socket.io server instance
 */
function initializeSocketHandlers(io) {
    io.on('connection', (socket) => {
        logger.info(`Socket connected: ${socket.id}`);

        let currentRoomId = null;
        let currentToken = null;

        /**
         * Join a room with token validation
         * Emits 'participants' with current list and 'user-joined' to others
         */
        socket.on('join-room', ({ roomId, token, displayName }) => {
            // Validate token
            if (!roomService.validateToken(roomId, token)) {
                socket.emit('error', { message: 'Invalid room token' });
                return;
            }

            // Store socket's room info
            currentRoomId = roomId;
            currentToken = token;

            // Join the Socket.io room
            socket.join(roomId);

            // Add participant to room service
            const participant = roomService.addParticipant(roomId, socket.id, {
                displayName: displayName || 'User',
                isMuted: false,
                isSpeaking: false
            });

            if (participant) {
                // Send current participants list to the joining user
                const participants = roomService.getParticipants(roomId);
                socket.emit('participants', { participants });

                // Notify others in the room
                socket.to(roomId).emit('user-joined', { participant });

                logger.info(`User ${socket.id} joined room ${roomId}`);
            }
        });

        /**
         * Leave room explicitly
         */
        socket.on('leave-room', () => {
            if (currentRoomId) {
                handleLeaveRoom(socket, currentRoomId);
                currentRoomId = null;
                currentToken = null;
            }
        });

        /**
         * Microphone state change
         */
        socket.on('mic-state', ({ isMuted }) => {
            if (!currentRoomId) return;

            const updated = roomService.updateParticipantState(currentRoomId, socket.id, { isMuted });
            if (updated) {
                // Broadcast to all in room including sender for confirmation
                io.to(currentRoomId).emit('user-mic-changed', {
                    odId: socket.id,
                    isMuted
                });
                logger.info(`User ${socket.id} mic state: ${isMuted ? 'muted' : 'unmuted'}`);
            }
        });

        /**
         * Speaking state change (for audio activity indicator)
         */
        socket.on('speaking', ({ isSpeaking }) => {
            if (!currentRoomId) return;

            const updated = roomService.updateParticipantState(currentRoomId, socket.id, { isSpeaking });
            if (updated) {
                // Broadcast speaking state to others
                socket.to(currentRoomId).emit('user-speaking', {
                    odId: socket.id,
                    isSpeaking
                });
            }
        });

        /**
         * Handle disconnect
         */
        socket.on('disconnect', (reason) => {
            logger.info(`Socket disconnected: ${socket.id} (${reason})`);
            if (currentRoomId) {
                handleLeaveRoom(socket, currentRoomId);
            }
        });
    });
}

/**
 * Handle user leaving a room
 * @param {import('socket.io').Socket} socket 
 * @param {string} roomId 
 */
function handleLeaveRoom(socket, roomId) {
    const removed = roomService.removeParticipant(roomId, socket.id);
    if (removed) {
        socket.leave(roomId);
        socket.to(roomId).emit('user-left', { odId: socket.id });
        logger.info(`User ${socket.id} left room ${roomId}`);
    }
}

module.exports = { initializeSocketHandlers };
