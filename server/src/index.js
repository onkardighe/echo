require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
    logger.info(`Server running on  http://localhost:${PORT}`);
});
