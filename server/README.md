# Echo Signaling Server

A simple Node.js + Express signaling server for the Echo Chrome Extension.
This server facilitates the exchange of WebRTC signaling data (Offers, Answers, ICE Candidates) between peers using a room-based mechanism.

## Setup

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Create a `.env` file (optional, defaults to port 3000):
    ```bash
    cp .env.example .env
    ```

## Running

-   Start production server:
    ```bash
    npm start
    ```

-   Start development server:
    ```bash
    npm run dev
    ```

## API Endpoints

-   `POST /api/rooms` - Create a new room. Returns `{ roomId }`.
-   `POST /api/rooms/:roomId/offer` - Submit Offer SDP. Body: `{ sdp }`.
-   `GET /api/rooms/:roomId/offer` - Retrieve Offer SDP.
-   `POST /api/rooms/:roomId/answer` - Submit Answer SDP. Body: `{ sdp }`.
-   `GET /api/rooms/:roomId/answer` - Retrieve Answer SDP.
-   `POST /api/rooms/:roomId/ice` - Submit ICE Candidate. Body: `{ candidate }`.
-   `GET /api/rooms/:roomId/ice` - Retrieve ICE Candidates.
