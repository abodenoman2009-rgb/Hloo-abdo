export type Language = 'ar' | 'en';
export type Theme = 'light' | 'dark';
export type PresenceStatus = 'online' | 'in-call' | 'busy' | 'offline';
export type CallType = 'video' | 'voice';
export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'reconnecting' | 'ended';
export type NavTab = 'home' | 'friends' | 'search' | 'history' | 'profile' | 'settings';

export interface UserPrivate {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  preferredLanguage: Language;
  preferredTheme: Theme;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicProfile {
  uid: string;
  displayName: string;
  handle: string;
  bio: string;
  photoURL: string;
  presence: PresenceStatus;
  isDiscoverable: boolean;
  lastSeen?: unknown;
  updatedAt?: unknown;
}

export interface FriendContact {
  friendshipId: string;
  uid: string;
  displayName: string;
  handle: string;
  bio: string;
  photoURL: string;
  presence: PresenceStatus;
}

export interface FriendRequestItem {
  id: string;
  fromUid: string;
  toUid: string;
  fromName: string;
  fromHandle: string;
  fromPhoto: string;
  toName: string;
  toHandle: string;
  toPhoto: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAtMs: number;
}

export interface CallHistoryItem {
  id: string;
  ownerUid: string;
  peerUid: string;
  peerName: string;
  peerPhoto: string;
  callType: CallType;
  direction: 'outgoing' | 'incoming';
  status: 'completed' | 'missed' | 'rejected' | 'cancelled';
  durationSeconds: number;
  roomCode: string;
  createdAtMs: number;
}

export interface NotificationItem {
  id: string;
  ownerUid: string;
  type: 'friend_request' | 'missed_call' | 'system';
  title: string;
  body: string;
  read: boolean;
  createdAtMs: number;
}

export interface DeviceItem {
  id: string;
  ownerUid: string;
  label: string;
  platform: 'web' | 'ios' | 'android';
  lastActiveAtMs: number;
}

export interface ActiveCallSession {
  callId: string;
  roomCode: string;
  callType: CallType;
  direction: 'outgoing' | 'incoming' | 'room';
  phase: CallPhase;
  peerUid: string;
  peerName: string;
  peerPhoto: string;
  startedAtMs: number | null;
  isRoomHost: boolean;
  localMuted: boolean;
  localCameraOff: boolean;
  peerMuted: boolean;
  peerCameraOff: boolean;
  facingMode: 'user' | 'environment';
  volume: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  mediaError: string | null;
}

export interface IceServerEntry {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type SignalingEvent =
  | { type: 'auth:ok'; uid: string; onlineUids: string[] }
  | { type: 'auth:error'; message: string }
  | { type: 'presence:sync'; onlineUids: string[]; busyUids: string[] }
  | { type: 'call:invite'; callId: string; roomCode: string; fromUid: string; fromName: string; fromPhoto: string; callType: CallType }
  | { type: 'call:ringing'; callId: string; toUid: string }
  | { type: 'call:accept'; callId: string; roomCode: string; byUid: string; byName: string; byPhoto: string; callType: CallType }
  | { type: 'call:reject'; callId: string; byUid: string; reason?: string }
  | { type: 'call:end'; callId: string; byUid: string }
  | { type: 'call:media-state'; callId: string; byUid: string; muted: boolean; cameraOff: boolean }
  | { type: 'room:peers'; roomCode: string; peers: Array<{ uid: string; displayName: string; photoURL: string }> }
  | { type: 'room:peer-joined'; roomCode: string; peer: { uid: string; displayName: string; photoURL: string } }
  | { type: 'room:peer-left'; roomCode: string; uid: string }
  | { type: 'webrtc:offer'; callId: string; fromUid: string; sdp: RTCSessionDescriptionInit }
  | { type: 'webrtc:answer'; callId: string; fromUid: string; sdp: RTCSessionDescriptionInit }
  | { type: 'webrtc:ice-candidate'; callId: string; fromUid: string; candidate: RTCIceCandidateInit }
  | { type: 'pong'; ts: number };
