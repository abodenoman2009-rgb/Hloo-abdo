-- ============================================================================
-- Wusul (وصل) - Portable PostgreSQL / Supabase Migration Schema
-- Reference relational schema for self-hosted PostgreSQL / Railway / Supabase
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  google_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 80),
  avatar_url TEXT NOT NULL DEFAULT '',
  email_verified BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Profiles
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle TEXT NOT NULL UNIQUE CHECK (handle ~ '^[a-zA-Z0-9_.\-]{2,40}$'),
  bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 200),
  presence TEXT NOT NULL DEFAULT 'offline' CHECK (presence IN ('online', 'in-call', 'busy', 'offline')),
  preferred_language TEXT NOT NULL DEFAULT 'ar' CHECK (preferred_language IN ('ar', 'en')),
  preferred_theme TEXT NOT NULL DEFAULT 'dark' CHECK (preferred_theme IN ('light', 'dark')),
  is_discoverable BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_handle ON profiles(handle);
CREATE INDEX IF NOT EXISTS idx_profiles_presence ON profiles(presence);

-- 3. Friends
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_distinct_friends CHECK (user_a <> user_b),
  CONSTRAINT uq_friendship_pair UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_friends_user_a ON friends(user_a);
CREATE INDEX IF NOT EXISTS idx_friends_user_b ON friends(user_b);

-- 4. Friend Requests
CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_distinct_request_users CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_to ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from ON friend_requests(from_user_id, status);

-- 5. Calls / Rooms
CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT NOT NULL UNIQUE CHECK (room_code ~ '^[A-Z0-9\-]{4,24}$'),
  host_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'voice')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'ringing', 'active', 'ended')),
  is_public_link BOOLEAN NOT NULL DEFAULT FALSE,
  invited_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_room_code ON calls(room_code);
CREATE INDEX IF NOT EXISTS idx_calls_host ON calls(host_user_id);

-- 6. Call Participants
CREATE TABLE IF NOT EXISTS call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('host', 'participant')),
  audio_muted BOOLEAN NOT NULL DEFAULT FALSE,
  video_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  CONSTRAINT uq_call_participant UNIQUE (call_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_call_participants_call ON call_participants(call_id);

-- 7. Call History
CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  peer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  peer_name TEXT NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('video', 'voice')),
  direction TEXT NOT NULL CHECK (direction IN ('outgoing', 'incoming')),
  status TEXT NOT NULL CHECK (status IN ('completed', 'missed', 'rejected', 'cancelled')),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0 AND duration_seconds <= 86400),
  room_code TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_history_owner_created ON call_history(owner_user_id, created_at DESC);

-- 8. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('friend_request', 'missed_call', 'system')),
  title TEXT NOT NULL CHECK (char_length(title) <= 120),
  body TEXT NOT NULL CHECK (char_length(body) <= 300),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

-- 9. Devices
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(label) <= 100),
  platform TEXT NOT NULL CHECK (platform IN ('web', 'ios', 'android')),
  push_token TEXT,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- 10. Sessions
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  user_agent TEXT NOT NULL DEFAULT '',
  ip_address TEXT NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);

-- ============================================================================
-- Row Level Security (Supabase / Postgres RLS)
-- ============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_select ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY users_self_update ON users FOR UPDATE USING (id = auth.uid());

CREATE POLICY profiles_public_read ON profiles FOR SELECT USING (is_discoverable = TRUE OR user_id = auth.uid());
CREATE POLICY profiles_self_write ON profiles FOR ALL USING (user_id = auth.uid());

CREATE POLICY friends_participant_access ON friends FOR ALL USING (user_a = auth.uid() OR user_b = auth.uid());
CREATE POLICY friend_requests_participant_access ON friend_requests FOR ALL USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY calls_participant_access ON calls FOR SELECT USING (
  host_user_id = auth.uid() OR invited_user_id = auth.uid() OR is_public_link = TRUE
);
CREATE POLICY call_history_owner_access ON call_history FOR ALL USING (owner_user_id = auth.uid());
CREATE POLICY notifications_owner_access ON notifications FOR ALL USING (user_id = auth.uid());
CREATE POLICY devices_owner_access ON devices FOR ALL USING (user_id = auth.uid());
CREATE POLICY sessions_owner_access ON sessions FOR ALL USING (user_id = auth.uid());
