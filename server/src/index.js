require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const logger = require('./utils/logger');
const { initializeSocketHandlers } = require('./services/socketHandler');

const PORT = process.env.PORT || 3003;

// Create HTTP server from Express app
const server = http.createServer(app);

// Initialize Socket.io with CORS
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// Initialize socket event handlers
initializeSocketHandlers(io);

// Start server
server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`WebSocket server ready`);
});
