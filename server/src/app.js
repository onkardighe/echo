const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api');
const logger = require('./utils/logger');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Not Found' });
});

module.exports = app;
