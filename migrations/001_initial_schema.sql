-- Wusul schema (PostgreSQL). Applied automatically at server start (idempotent).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT NOT NULL DEFAULT '',
  preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar','en')),
  preferred_theme TEXT NOT NULL DEFAULT 'dark' CHECK (preferred_theme IN ('light','dark')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  handle TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  presence TEXT NOT NULL DEFAULT 'offline' CHECK (presence IN ('online','in-call','busy','offline')),
  is_discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY,
  from_uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_uid <> to_uid)
);
CREATE INDEX IF NOT EXISTS idx_fr_to ON friend_requests(to_uid);
CREATE INDEX IF NOT EXISTS idx_fr_from ON friend_requests(from_uid);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (user_a <> user_b)
);
CREATE INDEX IF NOT EXISTS idx_fs_a ON friendships(user_a);
CREATE INDEX IF NOT EXISTS idx_fs_b ON friendships(user_b);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  room_code TEXT NOT NULL,
  host_uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video','voice')),
  status TEXT NOT NULL CHECK (status IN ('waiting','ringing','active','ended')),
  is_public_link BOOLEAN NOT NULL DEFAULT FALSE,
  invited_uid TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calls_room ON calls(room_code);

CREATE TABLE IF NOT EXISTS call_history (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_uid TEXT NOT NULL,
  peer_name TEXT NOT NULL,
  peer_photo TEXT NOT NULL DEFAULT '',
  call_type TEXT NOT NULL CHECK (call_type IN ('video','voice')),
  direction TEXT NOT NULL CHECK (direction IN ('outgoing','incoming')),
  status TEXT NOT NULL CHECK (status IN ('completed','missed','rejected','cancelled')),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds BETWEEN 0 AND 86400),
  room_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ch_owner ON call_history(owner_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('friend_request','missed_call','system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_owner ON notifications(owner_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT NOT NULL,
  owner_uid TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('web','ios','android')),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_uid, id)
);
