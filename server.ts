import http from 'http';
import path from 'path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { WebSocketServer, WebSocket } from 'ws';
import { z } from 'zod';
import dotenv from 'dotenv';
import { initDatabase, pool } from './server/db.ts';
import { authRouter, consumeWsTicket, requireSession } from './server/auth.ts';
import type { AuthedRequest as AuthenticatedRequest } from './server/auth.ts';
import { dataRouter } from './server/data.ts';
import { generateRoomCode } from './src/utils/callLogic.ts';
import { isValidId, isValidRoomCodeFormat } from './src/utils/validation.ts';
import type { CallType, IceServerEntry } from './src/types/app.ts';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '64kb' }));

// Baseline security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again shortly.' },
});

app.use('/api', apiLimiter);

app.use('/api/auth', authRouter);
app.use('/api/data', dataRouter);

function getConfiguredIceServers(): { iceServers: IceServerEntry[]; hasTurn: boolean } {
  const stunUrl = process.env.STUN_SERVER_URL?.trim() || 'stun:stun.l.google.com:19302';
  const servers: IceServerEntry[] = [
    { urls: stunUrl },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const turnUrl = process.env.TURN_SERVER_URL?.trim();
  const turnUser = process.env.TURN_USERNAME?.trim();
  const turnPass = process.env.TURN_PASSWORD?.trim();
  const hasTurn = Boolean(turnUrl && turnUser && turnPass);

  if (hasTurn && turnUrl && turnUser && turnPass) {
    servers.push({
      urls: turnUrl,
      username: turnUser,
      credential: turnPass,
    });
  }
  return { iceServers: servers, hasTurn };
}

// REST Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'wusul-signaling',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/ice-servers', (_req: Request, res: Response) => {
  const { iceServers, hasTurn } = getConfiguredIceServers();
  res.json({ iceServers, hasTurn });
});

app.post('/api/rooms/code', requireSession, (_req: AuthenticatedRequest, res: Response) => {
  res.json({ roomCode: generateRoomCode() });
});

app.get('/api/diagnostics/turn', (_req: Request, res: Response) => {
  const { iceServers, hasTurn } = getConfiguredIceServers();
  res.json({
    signalingReady: true,
    stunConfigured: iceServers.some((s) => String(s.urls).startsWith('stun:')),
    turnConfigured: hasTurn,
    iceServerCount: iceServers.length,
    checkedAt: new Date().toISOString(),
  });
});

// ============================================================================
// WebSocket Signaling Server (/ws)
// ============================================================================
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 128 * 1024 });

interface ConnectedClient {
  ws: WebSocket;
  uid: string;
  displayName: string;
  photoURL: string;
  busy: boolean;
  roomCode: string | null;
  msgCount: number;
  msgWindowStart: number;
}

const clientsBySocket = new Map<WebSocket, ConnectedClient>();
const socketsByUid = new Map<string, Set<WebSocket>>();
const rooms = new Map<string, Map<string, ConnectedClient>>();

const AuthMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string().min(20).max(512),
  displayName: z.string().max(80).optional(),
  photoURL: z.string().max(512).optional(),
});

const SignalingPayloadSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping'), ts: z.number().optional() }),
  z.object({ type: z.literal('presence:update'), busy: z.boolean() }),
  z.object({
    type: z.literal('call:invite'),
    callId: z.string().min(1).max(128),
    roomCode: z.string().min(4).max(24),
    toUid: z.string().min(1).max(128),
    callType: z.enum(['video', 'voice']),
  }),
  z.object({
    type: z.literal('call:accept'),
    callId: z.string().min(1).max(128),
    roomCode: z.string().min(4).max(24),
    toUid: z.string().min(1).max(128),
    callType: z.enum(['video', 'voice']),
  }),
  z.object({
    type: z.literal('call:reject'),
    callId: z.string().min(1).max(128),
    toUid: z.string().min(1).max(128),
    reason: z.string().max(80).optional(),
  }),
  z.object({
    type: z.literal('call:end'),
    callId: z.string().min(1).max(128),
    toUid: z.string().max(128).optional(),
    roomCode: z.string().max(24).optional(),
  }),
  z.object({
    type: z.literal('call:media-state'),
    callId: z.string().min(1).max(128),
    toUid: z.string().min(1).max(128),
    muted: z.boolean(),
    cameraOff: z.boolean(),
  }),
  z.object({
    type: z.literal('room:join'),
    roomCode: z.string().min(4).max(24),
    callType: z.enum(['video', 'voice']).optional(),
  }),
  z.object({
    type: z.literal('room:leave'),
    roomCode: z.string().min(4).max(24),
  }),
  z.object({
    type: z.literal('webrtc:offer'),
    callId: z.string().min(1).max(128),
    toUid: z.string().min(1).max(128),
    sdp: z.object({ type: z.string(), sdp: z.string().optional() }).passthrough(),
  }),
  z.object({
    type: z.literal('webrtc:answer'),
    callId: z.string().min(1).max(128),
    toUid: z.string().min(1).max(128),
    sdp: z.object({ type: z.string(), sdp: z.string().optional() }).passthrough(),
  }),
  z.object({
    type: z.literal('webrtc:ice-candidate'),
    callId: z.string().min(1).max(128),
    toUid: z.string().min(1).max(128),
    candidate: z.record(z.string(), z.unknown()),
  }),
]);

function sendJson(ws: WebSocket, payload: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sendToUser(uid: string, payload: unknown): boolean {
  const userSockets = socketsByUid.get(uid);
  if (!userSockets || userSockets.size === 0) return false;
  userSockets.forEach((sock) => sendJson(sock, payload));
  return true;
}

function broadcastPresence(): void {
  const onlineUids = Array.from(socketsByUid.keys());
  const busyUids: string[] = [];
  clientsBySocket.forEach((c) => {
    if (c.busy) busyUids.push(c.uid);
  });
  const payload = { type: 'presence:sync', onlineUids, busyUids };
  clientsBySocket.forEach((c) => sendJson(c.ws, payload));
}

function removeFromRoom(client: ConnectedClient): void {
  if (!client.roomCode) return;
  const code = client.roomCode;
  const room = rooms.get(code);
  client.roomCode = null;
  if (!room) return;
  room.delete(client.uid);
  room.forEach((peer) => {
    sendJson(peer.ws, { type: 'room:peer-left', roomCode: code, uid: client.uid });
  });
  if (room.size === 0) {
    rooms.delete(code);
  }
}

wss.on('connection', (ws: WebSocket) => {
  let authedClient: ConnectedClient | null = null;

  const authTimeout = setTimeout(() => {
    if (!authedClient) {
      sendJson(ws, { type: 'auth:error', message: 'Authentication timeout' });
      ws.close(4001, 'Auth timeout');
    }
  }, 15_000);

  ws.on('message', async (raw) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (!authedClient) {
      const authCheck = AuthMessageSchema.safeParse(parsed);
      if (!authCheck.success) {
        sendJson(ws, { type: 'auth:error', message: 'Invalid auth payload' });
        ws.close(4002, 'Invalid auth');
        return;
      }
      try {
        const uid = consumeWsTicket(authCheck.data.token);
        if (!uid) throw new Error('bad ticket');
        clearTimeout(authTimeout);
        const prof = (
          await pool.query('SELECT display_name, photo_url FROM profiles WHERE user_id=$1', [uid])
        ).rows[0];
        const client: ConnectedClient = {
          ws,
          uid,
          displayName: prof?.display_name || 'User',
          photoURL: prof?.photo_url || '',
          busy: false,
          roomCode: null,
          msgCount: 0,
          msgWindowStart: Date.now(),
        };
        authedClient = client;
        clientsBySocket.set(ws, client);
        if (!socketsByUid.has(uid)) socketsByUid.set(uid, new Set());
        socketsByUid.get(uid)!.add(ws);

        sendJson(ws, { type: 'auth:ok', uid, onlineUids: Array.from(socketsByUid.keys()) });
        broadcastPresence();
      } catch {
        sendJson(ws, { type: 'auth:error', message: 'Authentication failed' });
        ws.close(4003, 'Unauthorized');
      }
      return;
    }

    // Per-socket rate limiting (max 90 messages per 10 seconds)
    const now = Date.now();
    if (now - authedClient.msgWindowStart > 10_000) {
      authedClient.msgWindowStart = now;
      authedClient.msgCount = 0;
    }
    authedClient.msgCount += 1;
    if (authedClient.msgCount > 90) {
      return;
    }

    const msgCheck = SignalingPayloadSchema.safeParse(parsed);
    if (!msgCheck.success) return;
    const msg = msgCheck.data;

    switch (msg.type) {
      case 'ping':
        sendJson(ws, { type: 'pong', ts: msg.ts || Date.now() });
        break;

      case 'presence:update':
        authedClient.busy = msg.busy;
        broadcastPresence();
        break;

      case 'call:invite': {
        if (!isValidId(msg.toUid) || !isValidRoomCodeFormat(msg.roomCode)) return;
        authedClient.busy = true;
        const delivered = sendToUser(msg.toUid, {
          type: 'call:invite',
          callId: msg.callId,
          roomCode: msg.roomCode,
          fromUid: authedClient.uid,
          fromName: authedClient.displayName,
          fromPhoto: authedClient.photoURL,
          callType: msg.callType as CallType,
        });
        if (delivered) {
          sendJson(ws, { type: 'call:ringing', callId: msg.callId, toUid: msg.toUid });
        }
        broadcastPresence();
        break;
      }

      case 'call:accept': {
        if (!isValidId(msg.toUid)) return;
        authedClient.busy = true;
        sendToUser(msg.toUid, {
          type: 'call:accept',
          callId: msg.callId,
          roomCode: msg.roomCode,
          byUid: authedClient.uid,
          byName: authedClient.displayName,
          byPhoto: authedClient.photoURL,
          callType: msg.callType,
        });
        broadcastPresence();
        break;
      }

      case 'call:reject':
        if (!isValidId(msg.toUid)) return;
        authedClient.busy = false;
        sendToUser(msg.toUid, {
          type: 'call:reject',
          callId: msg.callId,
          byUid: authedClient.uid,
          reason: msg.reason,
        });
        broadcastPresence();
        break;

      case 'call:end':
        authedClient.busy = false;
        removeFromRoom(authedClient);
        if (msg.toUid && isValidId(msg.toUid)) {
          sendToUser(msg.toUid, {
            type: 'call:end',
            callId: msg.callId,
            byUid: authedClient.uid,
          });
        }
        broadcastPresence();
        break;

      case 'call:media-state':
        if (!isValidId(msg.toUid)) return;
        sendToUser(msg.toUid, {
          type: 'call:media-state',
          callId: msg.callId,
          byUid: authedClient.uid,
          muted: msg.muted,
          cameraOff: msg.cameraOff,
        });
        break;

      case 'room:join': {
        if (!isValidRoomCodeFormat(msg.roomCode)) return;
        removeFromRoom(authedClient);
        authedClient.roomCode = msg.roomCode;
        authedClient.busy = true;
        if (!rooms.has(msg.roomCode)) rooms.set(msg.roomCode, new Map());
        const room = rooms.get(msg.roomCode)!;
        const existingPeers = Array.from(room.values()).map((p) => ({
          uid: p.uid,
          displayName: p.displayName,
          photoURL: p.photoURL,
        }));
        room.set(authedClient.uid, authedClient);
        sendJson(ws, { type: 'room:peers', roomCode: msg.roomCode, peers: existingPeers });
        room.forEach((peer) => {
          if (peer.uid !== authedClient!.uid) {
            sendJson(peer.ws, {
              type: 'room:peer-joined',
              roomCode: msg.roomCode,
              peer: {
                uid: authedClient!.uid,
                displayName: authedClient!.displayName,
                photoURL: authedClient!.photoURL,
              },
            });
          }
        });
        broadcastPresence();
        break;
      }

      case 'room:leave':
        authedClient.busy = false;
        removeFromRoom(authedClient);
        broadcastPresence();
        break;

      case 'webrtc:offer':
        if (!isValidId(msg.toUid)) return;
        sendToUser(msg.toUid, {
          type: 'webrtc:offer',
          callId: msg.callId,
          fromUid: authedClient.uid,
          sdp: msg.sdp,
        });
        break;

      case 'webrtc:answer':
        if (!isValidId(msg.toUid)) return;
        sendToUser(msg.toUid, {
          type: 'webrtc:answer',
          callId: msg.callId,
          fromUid: authedClient.uid,
          sdp: msg.sdp,
        });
        break;

      case 'webrtc:ice-candidate':
        if (!isValidId(msg.toUid)) return;
        sendToUser(msg.toUid, {
          type: 'webrtc:ice-candidate',
          callId: msg.callId,
          fromUid: authedClient.uid,
          candidate: msg.candidate,
        });
        break;
    }
  });

  ws.on('close', () => {
    clearTimeout(authTimeout);
    if (!authedClient) return;
    clientsBySocket.delete(ws);
    removeFromRoom(authedClient);
    const set = socketsByUid.get(authedClient.uid);
    if (set) {
      set.delete(ws);
      if (set.size === 0) socketsByUid.delete(authedClient.uid);
    }
    broadcastPresence();
  });
});

// ============================================================================
// Frontend Serving (Vite Dev Middleware vs Production Static Dist)
// ============================================================================
async function startServer(): Promise<void> {
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Wusul server listening on http://0.0.0.0:${PORT}`);
  });
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

initDatabase()
  .then(() => startServer())
  .catch((err) => {
    console.error('Startup failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
