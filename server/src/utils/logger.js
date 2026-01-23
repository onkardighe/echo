const logger = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
    error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, err || ''),
    log: (msg) => console.log(`[LOG] ${new Date().toISOString()} - ${msg}`)
};

module.exports = logger;
