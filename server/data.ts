import type { Response } from 'express';
import { asyncRouter } from './asyncRouter.ts';
import { z } from 'zod';
import { pool } from './db.ts';
import { requireSession, type AuthedRequest } from './auth.ts';
import {
  clampDurationSeconds,
  isSafeMediaUrl,
  isValidHandle,
  isValidId,
  sanitizeBio,
  sanitizeDisplayName,
  sanitizeHandle,
  sanitizeRoomCode,
} from '../src/utils/validation.ts';

export const dataRouter = asyncRouter();
dataRouter.use(requireSession);

const ms = (d: Date | string) => new Date(d).getTime();
const bad = (res: Response, msg = 'Invalid input') => res.status(400).json({ error: msg });

function profileRow(r: Record<string, unknown>) {
  return {
    uid: r.user_id as string,
    displayName: r.display_name as string,
    handle: r.handle as string,
    bio: r.bio as string,
    photoURL: r.photo_url as string,
    presence: r.presence as string,
    isDiscoverable: r.is_discoverable as boolean,
  };
}

const Bootstrap = z.object({
  deviceId: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
  platform: z.enum(['web', 'ios', 'android']),
  label: z.string().max(100),
});

dataRouter.post('/bootstrap', async (req: AuthedRequest, res) => {
  const p = Bootstrap.safeParse(req.body);
  if (!p.success) return bad(res);
  const uid = req.uid!;
  const u = (await pool.query('SELECT * FROM users WHERE id=$1', [uid])).rows[0];
  const pub = (await pool.query('SELECT * FROM profiles WHERE user_id=$1', [uid])).rows[0];
  if (!u || !pub) return res.status(404).json({ error: 'Profile not found' });
  await pool.query(
    `INSERT INTO devices (id, owner_uid, label, platform) VALUES ($1,$2,$3,$4)
     ON CONFLICT (owner_uid, id) DO UPDATE SET label=$3, platform=$4, last_active_at=NOW()`,
    [p.data.deviceId, uid, p.data.label, p.data.platform]
  );
  res.json({
    privateUser: {
      uid,
      email: u.email,
      displayName: u.display_name,
      photoURL: u.photo_url,
      preferredLanguage: u.preferred_language,
      preferredTheme: u.preferred_theme,
    },
    publicProfile: profileRow(pub),
  });
});

dataRouter.patch('/preferences', async (req: AuthedRequest, res) => {
  const p = z
    .object({ preferredLanguage: z.enum(['ar', 'en']).optional(), preferredTheme: z.enum(['light', 'dark']).optional() })
    .safeParse(req.body);
  if (!p.success) return bad(res);
  await pool.query(
    `UPDATE users SET preferred_language=COALESCE($2,preferred_language),
       preferred_theme=COALESCE($3,preferred_theme), updated_at=NOW() WHERE id=$1`,
    [req.uid, p.data.preferredLanguage ?? null, p.data.preferredTheme ?? null]
  );
  res.json({ ok: true });
});

dataRouter.put('/profile', async (req: AuthedRequest, res) => {
  const p = z
    .object({
      displayName: z.string(),
      handle: z.string(),
      bio: z.string(),
      photoURL: z.string(),
      isDiscoverable: z.boolean(),
    })
    .safeParse(req.body);
  if (!p.success) return bad(res);
  const name = sanitizeDisplayName(p.data.displayName);
  const handle = sanitizeHandle(p.data.handle);
  if (!name || !isValidHandle(handle)) return bad(res, 'Invalid display name or handle format.');
  const photo = isSafeMediaUrl(p.data.photoURL) ? p.data.photoURL : '';
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE users SET display_name=$2, photo_url=$3, updated_at=NOW() WHERE id=$1', [
      req.uid,
      name,
      photo,
    ]);
    await client.query(
      `UPDATE profiles SET display_name=$2, handle=$3, bio=$4, photo_url=$5, is_discoverable=$6,
         last_seen=NOW(), updated_at=NOW() WHERE user_id=$1`,
      [req.uid, name, handle, sanitizeBio(p.data.bio), photo, p.data.isDiscoverable]
    );
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
});

dataRouter.get('/search', async (req: AuthedRequest, res) => {
  const term = String(req.query.q || '').trim().toLowerCase().slice(0, 80);
  const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const r = await pool.query(
    `SELECT * FROM profiles WHERE is_discoverable AND user_id <> $1
       AND ($2 = '' OR lower(display_name) LIKE $3 OR lower(handle) LIKE $3 OR lower(bio) LIKE $3)
     ORDER BY display_name LIMIT 40`,
    [req.uid, term, like]
  );
  res.json(r.rows.map(profileRow));
});

dataRouter.post('/friend-requests', async (req: AuthedRequest, res) => {
  const p = z.object({ toUid: z.string() }).safeParse(req.body);
  if (!p.success || !isValidId(p.data.toUid) || p.data.toUid === req.uid) return bad(res);
  const me = (await pool.query('SELECT * FROM profiles WHERE user_id=$1', [req.uid])).rows[0];
  const to = (await pool.query('SELECT * FROM profiles WHERE user_id=$1', [p.data.toUid])).rows[0];
  if (!me || !to) return res.status(404).json({ error: 'User not found' });
  const id = `${req.uid}_${p.data.toUid}`.slice(0, 128);
  await pool.query(
    `INSERT INTO friend_requests (id, from_uid, to_uid, status) VALUES ($1,$2,$3,'pending')
     ON CONFLICT (id) DO UPDATE SET status='pending', updated_at=NOW()`,
    [id, req.uid, p.data.toUid]
  );
  res.status(201).json({ id });
});

dataRouter.post('/friend-requests/:id/respond', async (req: AuthedRequest, res) => {
  const p = z.object({ decision: z.enum(['accepted', 'rejected']) }).safeParse(req.body);
  if (!p.success) return bad(res);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `UPDATE friend_requests SET status=$3, updated_at=NOW()
       WHERE id=$1 AND to_uid=$2 RETURNING from_uid, to_uid`,
      [req.params.id, req.uid, p.data.decision]
    );
    if (!r.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }
    if (p.data.decision === 'accepted') {
      const [a, b] = [r.rows[0].from_uid as string, r.rows[0].to_uid as string].sort();
      await client.query(
        `INSERT INTO friendships (id, user_a, user_b) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`,
        [`${a}_${b}`.slice(0, 128), a, b]
      );
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
});

dataRouter.delete('/friend-requests/:id', async (req: AuthedRequest, res) => {
  await pool.query('DELETE FROM friend_requests WHERE id=$1 AND (from_uid=$2 OR to_uid=$2)', [
    req.params.id,
    req.uid,
  ]);
  res.json({ ok: true });
});

dataRouter.delete('/friendships/:id', async (req: AuthedRequest, res) => {
  await pool.query('DELETE FROM friendships WHERE id=$1 AND (user_a=$2 OR user_b=$2)', [req.params.id, req.uid]);
  res.json({ ok: true });
});

dataRouter.post('/calls', async (req: AuthedRequest, res) => {
  const p = z
    .object({
      callId: z.string(),
      roomCode: z.string(),
      callType: z.enum(['video', 'voice']),
      isPublicLink: z.boolean(),
      invitedUid: z.string().max(128).optional(),
    })
    .safeParse(req.body);
  if (!p.success || !isValidId(p.data.callId)) return bad(res);
  const me = (await pool.query('SELECT display_name FROM profiles WHERE user_id=$1', [req.uid])).rows[0];
  await pool.query(
    `INSERT INTO calls (id, room_code, host_uid, call_type, status, is_public_link, invited_uid)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      p.data.callId,
      sanitizeRoomCode(p.data.roomCode),
      req.uid,
      p.data.callType,
      p.data.isPublicLink ? 'waiting' : 'ringing',
      p.data.isPublicLink,
      p.data.invitedUid || '',
    ]
  );
  void me;
  res.status(201).json({ ok: true });
});

dataRouter.patch('/calls/:id/status', async (req: AuthedRequest, res) => {
  const p = z
    .object({ status: z.enum(['waiting', 'ringing', 'active', 'ended']), callType: z.enum(['video', 'voice']).optional() })
    .safeParse(req.body);
  if (!p.success) return bad(res);
  await pool.query(
    `UPDATE calls SET status=$2, call_type=COALESCE($3,call_type), updated_at=NOW()
     WHERE id=$1 AND (host_uid=$4 OR invited_uid=$4 OR is_public_link)`,
    [req.params.id, p.data.status, p.data.callType ?? null, req.uid]
  );
  res.json({ ok: true });
});

dataRouter.post('/call-history', async (req: AuthedRequest, res) => {
  const p = z
    .object({
      peerUid: z.string().max(128),
      peerName: z.string(),
      peerPhoto: z.string(),
      callType: z.enum(['video', 'voice']),
      direction: z.enum(['outgoing', 'incoming']),
      status: z.enum(['completed', 'missed', 'rejected', 'cancelled']),
      durationSeconds: z.number(),
      roomCode: z.string(),
    })
    .safeParse(req.body);
  if (!p.success) return bad(res);
  const d = p.data;
  const id = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await pool.query(
    `INSERT INTO call_history (id, owner_uid, peer_uid, peer_name, peer_photo, call_type, direction, status, duration_seconds, room_code)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      req.uid,
      d.peerUid,
      sanitizeDisplayName(d.peerName) || 'Participant',
      isSafeMediaUrl(d.peerPhoto) ? d.peerPhoto : '',
      d.callType,
      d.direction,
      d.status,
      clampDurationSeconds(d.durationSeconds),
      sanitizeRoomCode(d.roomCode || 'ROOM'),
    ]
  );
  res.status(201).json({ id });
});

dataRouter.delete('/call-history/:id', async (req: AuthedRequest, res) => {
  await pool.query('DELETE FROM call_history WHERE id=$1 AND owner_uid=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

dataRouter.post('/notifications/:id/read', async (req: AuthedRequest, res) => {
  await pool.query('UPDATE notifications SET read=TRUE WHERE id=$1 AND owner_uid=$2', [req.params.id, req.uid]);
  res.json({ ok: true });
});

dataRouter.get('/friendships', async (req: AuthedRequest, res) => {
  const r = await pool.query(
    `SELECT f.id AS friendship_id, p.*
       FROM friendships f
       JOIN profiles p ON p.user_id = CASE WHEN f.user_a=$1 THEN f.user_b ELSE f.user_a END
      WHERE f.user_a=$1 OR f.user_b=$1`,
    [req.uid]
  );
  res.json(
    r.rows.map((row) => ({
      friendshipId: row.friendship_id,
      uid: row.user_id,
      displayName: row.display_name,
      handle: row.handle,
      bio: row.bio,
      photoURL: row.photo_url,
      presence: row.presence,
    }))
  );
});

dataRouter.get('/friend-requests', async (req: AuthedRequest, res) => {
  const r = await pool.query(
    `SELECT fr.*, pf.display_name AS from_name, pf.handle AS from_handle, pf.photo_url AS from_photo,
            pt.display_name AS to_name, pt.handle AS to_handle, pt.photo_url AS to_photo
       FROM friend_requests fr
       JOIN profiles pf ON pf.user_id = fr.from_uid
       JOIN profiles pt ON pt.user_id = fr.to_uid
      WHERE fr.from_uid=$1 OR fr.to_uid=$1
      ORDER BY fr.created_at DESC`,
    [req.uid]
  );
  res.json(
    r.rows.map((x) => ({
      id: x.id,
      fromUid: x.from_uid,
      toUid: x.to_uid,
      fromName: x.from_name,
      fromHandle: x.from_handle,
      fromPhoto: x.from_photo,
      toName: x.to_name,
      toHandle: x.to_handle,
      toPhoto: x.to_photo,
      status: x.status,
      createdAtMs: ms(x.created_at),
    }))
  );
});

dataRouter.get('/call-history', async (req: AuthedRequest, res) => {
  const r = await pool.query('SELECT * FROM call_history WHERE owner_uid=$1 ORDER BY created_at DESC LIMIT 50', [
    req.uid,
  ]);
  res.json(
    r.rows.map((x) => ({
      id: x.id,
      ownerUid: x.owner_uid,
      peerUid: x.peer_uid,
      peerName: x.peer_name,
      peerPhoto: x.peer_photo,
      callType: x.call_type,
      direction: x.direction,
      status: x.status,
      durationSeconds: x.duration_seconds,
      roomCode: x.room_code,
      createdAtMs: ms(x.created_at),
    }))
  );
});

dataRouter.get('/notifications', async (req: AuthedRequest, res) => {
  const r = await pool.query('SELECT * FROM notifications WHERE owner_uid=$1 ORDER BY created_at DESC LIMIT 20', [
    req.uid,
  ]);
  res.json(
    r.rows.map((x) => ({
      id: x.id,
      ownerUid: x.owner_uid,
      type: x.type,
      title: x.title,
      body: x.body,
      read: x.read,
      createdAtMs: ms(x.created_at),
    }))
  );
});

dataRouter.get('/devices', async (req: AuthedRequest, res) => {
  const r = await pool.query('SELECT * FROM devices WHERE owner_uid=$1 ORDER BY last_active_at DESC', [req.uid]);
  res.json(
    r.rows.map((x) => ({
      id: x.id,
      ownerUid: x.owner_uid,
      label: x.label,
      platform: x.platform,
      lastActiveAtMs: ms(x.last_active_at),
    }))
  );
});
