import crypto from 'crypto';
import { promisify } from 'util';
import type { NextFunction, Request, Response } from 'express';
import { asyncRouter } from './asyncRouter.ts';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { pool } from './db.ts';
import { buildInitialUserRecords } from '../src/utils/validation.ts';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

const COOKIE = 'wusul_session';
const SESSION_DAYS = 30;
const IS_PROD = process.env.NODE_ENV === 'production';

export interface AuthedRequest extends Request {
  uid?: string;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, saltHex, keyHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function createSession(res: Response, uid: string): Promise<void> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1,$2,$3)', [
    sha256(token),
    uid,
    expires,
  ]);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    expires,
    path: '/',
  });
}

export async function uidFromRequest(req: Request): Promise<string | null> {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return null;
  const r = await pool.query(
    'SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > NOW()',
    [sha256(token)]
  );
  return r.rows[0]?.user_id ?? null;
}

export async function requireSession(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const uid = await uidFromRequest(req);
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized', code: 'auth/unauthenticated' });
      return;
    }
    req.uid = uid;
    next();
  } catch (err) {
    next(err);
  }
}

// Short-lived single-use tickets so the WebSocket can authenticate without exposing the cookie.
const wsTickets = new Map<string, { uid: string; exp: number }>();

export function consumeWsTicket(ticket: string): string | null {
  const t = wsTickets.get(ticket);
  wsTickets.delete(ticket);
  if (!t || t.exp < Date.now()) return null;
  return t.uid;
}

const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts', code: 'auth/too-many-requests' },
});

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200),
});
const Register = Credentials.extend({ displayName: z.string().trim().max(80).optional() });

export const authRouter = asyncRouter();

authRouter.post('/register', authLimiter, async (req: Request, res: Response) => {
  const parsed = Register.safeParse(req.body);
  if (!parsed.success) {
    const pwBad = parsed.error.issues.some((i) => i.path[0] === 'password');
    res.status(400).json({ error: 'Invalid input', code: pwBad ? 'auth/weak-password' : 'auth/invalid-email' });
    return;
  }
  const { email, password, displayName } = parsed.data;
  const uid = crypto.randomUUID();
  const lang = req.body?.preferredLanguage === 'en' ? 'en' : 'ar';
  const theme = req.body?.preferredTheme === 'light' ? 'light' : 'dark';
  const initial = buildInitialUserRecords({
    uid,
    email,
    displayName,
    photoURL: '',
    preferredLanguage: lang,
    preferredTheme: theme,
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO users (id, email, password_hash, display_name, preferred_language, preferred_theme)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [uid, email, await hashPassword(password), initial.privateUser.displayName, lang, theme]
    );
    await client.query(
      `INSERT INTO profiles (user_id, display_name, handle, presence) VALUES ($1,$2,$3,'offline')`,
      [uid, initial.publicProfile.displayName, initial.publicProfile.handle]
    );
    await client.query(
      `INSERT INTO notifications (id, owner_uid, type, title, body) VALUES ($1,$2,'system',$3,$4)`,
      [
        `welcome_${uid.slice(0, 12)}`,
        uid,
        lang === 'ar' ? 'مرحباً بك في وصل' : 'Welcome to Wusul',
        lang === 'ar'
          ? 'تم إعداد ملفك الشخصي بنجاح. يمكنك الآن البحث عن الأصدقاء وبدء مكالمات الفيديو والصوت.'
          : 'Your profile is ready. Search for friends or start an instant video or voice call.',
      ]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    if ((err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'Email already registered', code: 'auth/email-already-in-use' });
      return;
    }
    console.error('register failed', err);
    res.status(500).json({ error: 'Server error' });
    return;
  } finally {
    client.release();
  }
  await createSession(res, uid);
  res.status(201).json({ ok: true });
});

// Constant-ish work for unknown emails to avoid revealing which accounts exist.
const DUMMY_HASH = `scrypt$${'00'.repeat(16)}$${'00'.repeat(64)}`;

authRouter.post('/login', authLimiter, async (req: Request, res: Response) => {
  const parsed = Credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', code: 'auth/invalid-credential' });
    return;
  }
  const { email, password } = parsed.data;
  const r = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
  const row = r.rows[0];
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) {
    res.status(401).json({ error: 'Incorrect email or password', code: 'auth/invalid-credential' });
    return;
  }
  await createSession(res, row.id);
  res.json({ ok: true });
});

authRouter.post('/logout', async (req: Request, res: Response) => {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireSession, async (req: AuthedRequest, res: Response) => {
  const r = await pool.query(
    'SELECT id, email, display_name, photo_url FROM users WHERE id = $1',
    [req.uid]
  );
  const u = r.rows[0];
  if (!u) {
    res.status(401).json({ error: 'Unauthorized', code: 'auth/unauthenticated' });
    return;
  }
  res.json({ uid: u.id, email: u.email, displayName: u.display_name, photoURL: u.photo_url });
});

authRouter.post('/ws-ticket', requireSession, (req: AuthedRequest, res: Response) => {
  const ticket = crypto.randomBytes(24).toString('base64url');
  wsTickets.set(ticket, { uid: req.uid!, exp: Date.now() + 30_000 });
  for (const [k, v] of wsTickets) if (v.exp < Date.now()) wsTickets.delete(k);
  res.json({ ticket });
});
