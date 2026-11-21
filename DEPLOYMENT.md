# Wusul (وصل) — Architecture, Setup & Deployment Guide

## 1. System Overview
- **Frontend**: React 19, TypeScript, Tailwind CSS v4, WebRTC (`RTCPeerConnection`), Web Audio API (ringtones + mic level metering), Arabic (RTL) & English (LTR), Light & Dark themes.
- **Backend**: Node.js + Express + TypeScript (`server.ts`, `server/`) with an integrated `ws` WebSocket signaling server on `/ws`, rate limiting and Zod payload validation.
- **Auth**: email + password (`server/auth.ts`). Passwords are hashed with scrypt; sessions are random tokens stored hashed in Postgres and sent as an httpOnly, SameSite=Lax cookie. The WebSocket authenticates with a single-use 30-second ticket from `POST /api/auth/ws-ticket`.
- **Database**: PostgreSQL (`DATABASE_URL`). The schema in `migrations/001_initial_schema.sql` is applied automatically at server start. Data API: `server/data.ts` under `/api/data/*`. Firebase is not used.

## 2. Environment Variables Matrix

| Variable | Service | Purpose | How to Obtain / Generate | Visibility | Where Added |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server | PostgreSQL connection string | Railway Postgres: `${{Postgres.DATABASE_URL}}` | **Secret** | Service variables |
| `APP_URL` | Hosting Runtime | Canonical URL for room invite links & origin checks | Auto-injected by Cloud Run / Railway | Public | Server `.env` |
| `ALLOWED_ORIGINS` | Origin Guard | Extra trusted domains for WebSocket/CORS | Your custom domain URL | Config | Server `.env` |
| `STUN_SERVER_URL` | WebRTC STUN | NAT traversal public IP discovery | Default `stun:stun.l.google.com:19302` | Public | Server `.env` |
| `TURN_SERVER_URL` | WebRTC TURN | Media relay over strict mobile/corporate NATs | Coturn / Metered.ca / Twilio | Config | Server `.env` |
| `TURN_USERNAME` | WebRTC TURN | TURN relay auth username | From your TURN provider dashboard | Secret | Server `.env` |
| `TURN_PASSWORD` | WebRTC TURN | TURN relay auth credential | From your TURN provider dashboard | **Secret** | Server `.env` |
| `RATE_LIMIT_WINDOW_MS` | API Guard | Rate limit window in ms (default `60000`) | Numeric configuration | Config | Server `.env` |
| `RATE_LIMIT_MAX_REQUESTS` | API Guard | Max requests per IP per window (default `120`) | Numeric configuration | Config | Server `.env` |

> Never commit TURN secrets or database URLs to Git.

## 3. Running Locally
```bash
docker compose up -d   # local Postgres
npm install
DATABASE_URL=postgres://wusul:wusul@localhost:5432/wusul npm run dev
```
The server starts on `http://localhost:3000` (serving both the Vite frontend, `/api/*`, and WebSocket signaling at `/ws`).

## 4. Running Unit Tests
```bash
npx --yes tsx --test src/utils/callLogic.test.ts src/utils/validation.test.ts
```

## 5. Deploying to Production (Cloud Run / Railway)
1. Add a PostgreSQL database and set `DATABASE_URL` (Railway: `${{Postgres.DATABASE_URL}}`). Set `APP_URL`, `TURN_SERVER_URL`, `TURN_USERNAME`, `TURN_PASSWORD` in your hosting provider's Secrets / Environment Variables panel.
2. Ensure HTTPS/WSS is active (WebRTC `getUserMedia` requires HTTPS on all non-localhost origins, especially iOS Safari and Android Chrome).
3. Build and start:
   ```bash
   npm run build
   npm start
   ```
