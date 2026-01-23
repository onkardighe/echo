# Echo - P2P Audio Calling Extension

## Production Deployment

### Backend (Render)

1.  **Create Web Service**:
    -   Connect your repo to Render.
    -   Auto-detection should find the `server/` directory (if not, specify Root Directory as `server`).

2.  **Configuration**:
    -   **Build Command**: `npm install`
    -   **Start Command**: `npm start`
    -   **Environment Variables**:
        -   `PORT`: `10000` (or whatever Render assigns)
        -   `NODE_ENV`: `production`
        -   `CORS_ORIGINS`: `chrome-extension://<YOUR_EXTENSION_ID>` (comma-separated if testing locally too)

3.  **Health Check**:
    -   Verify deployment at `https://<your-app>.onrender.com/health`

### Extension (Chrome Web Store)

1.  **Environment Setup**:
    -   Copy `server/.env.example` to `server/.env` for local testing.
    -   Create `.env.production` in the root with your Render URL:
        ```
        API_BASE_URL=https://<your-app>.onrender.com
        ```

2.  **Build**:
    -   Run `npm run build` (uses `NODE_ENV=production` automatically if set, or just default).
    -   To force production build:
        ```bash
        set NODE_ENV=production
        node build.js
        ```
    -   This generates `dist/` with the correct API URL injected.

3.  **Submit**:
    -   Zip the `dist/` folder.
    -   Upload to Chrome Web Store Dashboard.

## Verification Commands

### Backend Local Production
```bash
cd server
npm install
# Linux/Mac
PORT=4000 NODE_ENV=production npm start
# Windows
set PORT=4000 && set NODE_ENV=production && npm start
```

### Extension Production Build
```bash
# Ensure .env.production exists
node build.js
# Check dist/sidepanel.js to verify API_BASE_URL replacement
```
