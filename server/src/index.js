require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const logger = require('./utils/logger');
const { initializeSocketHandlers } = require('./services/socketHandler');

const PORT = process.env.PORT || 3003;

// Create HTTP server from Express app
const server = http.createServer(app);

const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : '*';

// Initialize Socket.io with CORS
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST']
    }
});

// Initialize socket event handlers
initializeSocketHandlers(io);

// Start server
const httpServer = server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`);
    logger.info(`WebSocket server ready`);
});

// Graceful Shutdown
const shutdown = () => {
    logger.info('SIGTERM/SIGINT received. Shutting down gracefully...');

    // Close WebSocket connections
    io.close(() => {
        logger.info('Socket.io closed.');
    });

    // Close HTTP server
    httpServer.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
    });

    // Force close after 10s
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
