import type {
  ActiveCallSession,
  CallHistoryItem,
  CallType,
  FriendContact,
  IceServerEntry,
  PresenceStatus,
} from '../types/app';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRoomCode(randomSource?: () => number): string {
  const rand = randomSource || Math.random;
  const pick = (len: number) => {
    let out = '';
    for (let i = 0; i < len; i += 1) {
      const idx = Math.floor(rand() * ROOM_ALPHABET.length) % ROOM_ALPHABET.length;
      out += ROOM_ALPHABET[idx];
    }
    return out;
  };
  return `${pick(3)}-${pick(4)}`;
}

export function formatCallDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
}

export function buildIceConfiguration(servers?: IceServerEntry[]): RTCConfiguration {
  const defaults: IceServerEntry[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
  const merged = servers && servers.length > 0 ? servers : defaults;
  return {
    iceServers: merged,
    iceCandidatePoolSize: 8,
  };
}

export function createOutgoingCallSession(params: {
  callId: string;
  roomCode: string;
  callType: CallType;
  peerUid: string;
  peerName: string;
  peerPhoto: string;
  isRoomHost?: boolean;
}): ActiveCallSession {
  return {
    callId: params.callId,
    roomCode: params.roomCode,
    callType: params.callType,
    direction: params.isRoomHost ? 'room' : 'outgoing',
    phase: 'outgoing',
    peerUid: params.peerUid,
    peerName: params.peerName,
    peerPhoto: params.peerPhoto,
    startedAtMs: null,
    isRoomHost: Boolean(params.isRoomHost),
    localMuted: false,
    localCameraOff: params.callType === 'voice',
    peerMuted: false,
    peerCameraOff: params.callType === 'voice',
    facingMode: 'user',
    volume: 1,
    connectionQuality: 'excellent',
    mediaError: null,
  };
}

export function createIncomingCallSession(params: {
  callId: string;
  roomCode: string;
  callType: CallType;
  fromUid: string;
  fromName: string;
  fromPhoto: string;
}): ActiveCallSession {
  return {
    callId: params.callId,
    roomCode: params.roomCode,
    callType: params.callType,
    direction: 'incoming',
    phase: 'incoming',
    peerUid: params.fromUid,
    peerName: params.fromName,
    peerPhoto: params.fromPhoto,
    startedAtMs: null,
    isRoomHost: false,
    localMuted: false,
    localCameraOff: params.callType === 'voice',
    peerMuted: false,
    peerCameraOff: params.callType === 'voice',
    facingMode: 'user',
    volume: 1,
    connectionQuality: 'excellent',
    mediaError: null,
  };
}

export type CallSessionAction =
  | { type: 'ACCEPT'; callType?: CallType }
  | { type: 'CONNECTED'; nowMs: number }
  | { type: 'RECONNECTING' }
  | { type: 'RECOVERED' }
  | { type: 'TOGGLE_MUTE' }
  | { type: 'TOGGLE_CAMERA' }
  | { type: 'SWITCH_FACING' }
  | { type: 'SET_VOLUME'; volume: number }
  | { type: 'SET_CALL_TYPE'; callType: CallType }
  | { type: 'PEER_MEDIA'; muted: boolean; cameraOff: boolean }
  | { type: 'SET_QUALITY'; quality: ActiveCallSession['connectionQuality'] }
  | { type: 'MEDIA_ERROR'; message: string | null }
  | { type: 'END' };

export function reduceCallSession(
  state: ActiveCallSession | null,
  action: CallSessionAction
): ActiveCallSession | null {
  if (!state) return null;
  switch (action.type) {
    case 'ACCEPT': {
      const nextType = action.callType ?? state.callType;
      return {
        ...state,
        callType: nextType,
        localCameraOff: nextType === 'voice',
        phase: 'connecting',
      };
    }
    case 'CONNECTED':
      return {
        ...state,
        phase: 'active',
        startedAtMs: state.startedAtMs ?? action.nowMs,
      };
    case 'RECONNECTING':
      if (state.phase === 'ended') return state;
      return {
        ...state,
        phase: 'reconnecting',
      };
    case 'RECOVERED':
      if (state.phase === 'ended') return state;
      return {
        ...state,
        phase: 'active',
      };
    case 'TOGGLE_MUTE':
      return { ...state, localMuted: !state.localMuted };
    case 'TOGGLE_CAMERA':
      return { ...state, localCameraOff: !state.localCameraOff };
    case 'SWITCH_FACING':
      return {
        ...state,
        facingMode: state.facingMode === 'user' ? 'environment' : 'user',
      };
    case 'SET_VOLUME':
      return {
        ...state,
        volume: Math.max(0, Math.min(1, action.volume)),
      };
    case 'SET_CALL_TYPE':
      return {
        ...state,
        callType: action.callType,
        localCameraOff: action.callType === 'voice',
      };
    case 'PEER_MEDIA':
      return {
        ...state,
        peerMuted: action.muted,
        peerCameraOff: action.cameraOff,
      };
    case 'SET_QUALITY':
      return {
        ...state,
        connectionQuality: action.quality,
      };
    case 'MEDIA_ERROR':
      return {
        ...state,
        mediaError: action.message,
      };
    case 'END':
      return {
        ...state,
        phase: 'ended',
      };
    default:
      return state;
  }
}

export type HistoryFilter = 'all' | 'missed' | 'video' | 'voice';

export function filterCallHistory(
  entries: CallHistoryItem[],
  filter: HistoryFilter,
  query: string
): CallHistoryItem[] {
  const q = query.trim().toLowerCase();
  return entries.filter((item) => {
    if (filter === 'missed' && item.status !== 'missed') return false;
    if (filter === 'video' && item.callType !== 'video') return false;
    if (filter === 'voice' && item.callType !== 'voice') return false;
    if (!q) return true;
    return (
      item.peerName.toLowerCase().includes(q) ||
      item.roomCode.toLowerCase().includes(q)
    );
  });
}

export function filterContacts(
  contacts: FriendContact[],
  onlyOnline: boolean,
  query: string
): FriendContact[] {
  const q = query.trim().toLowerCase();
  return contacts.filter((c) => {
    if (onlyOnline && c.presence === 'offline') return false;
    if (!q) return true;
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      c.bio.toLowerCase().includes(q)
    );
  });
}

export function sortContactsByPresence(contacts: FriendContact[]): FriendContact[] {
  const rank: Record<PresenceStatus, number> = {
    online: 0,
    'in-call': 1,
    busy: 2,
    offline: 3,
  };
  return [...contacts].sort((a, b) => {
    const diff = rank[a.presence] - rank[b.presence];
    if (diff !== 0) return diff;
    return a.displayName.localeCompare(b.displayName);
  });
}
