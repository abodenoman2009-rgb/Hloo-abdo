import { api } from './api';
import type { AppUser } from '../services/auth';
import type {
  CallHistoryItem,
  CallType,
  DeviceItem,
  FriendContact,
  FriendRequestItem,
  Language,
  NotificationItem,
  PublicProfile,
  Theme,
  UserPrivate,
} from '../types/app';

type Unsubscribe = () => void;

export async function bootstrapUser(
  _user: AppUser
): Promise<{ privateUser: UserPrivate; publicProfile: PublicProfile }> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const platform: 'web' | 'ios' | 'android' = /iPhone|iPad/i.test(ua)
    ? 'ios'
    : /Android/i.test(ua)
      ? 'android'
      : 'web';
  const deviceId = `web_${/Mobile|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop'}`;
  const label =
    platform === 'ios' ? 'iPhone / iPad Safari' : platform === 'android' ? 'Android Browser' : 'Desktop Web Browser';
  return api('/api/data/bootstrap', { body: { deviceId, platform, label } });
}

export async function updateUserPreferences(
  _uid: string,
  prefs: { preferredLanguage?: Language; preferredTheme?: Theme }
): Promise<void> {
  await api('/api/data/preferences', { method: 'PATCH', body: prefs });
}

export async function saveProfileEdits(
  _uid: string,
  updates: { displayName: string; handle: string; bio: string; photoURL: string; isDiscoverable: boolean }
): Promise<void> {
  await api('/api/data/profile', { method: 'PUT', body: updates });
}

export async function searchPublicDirectory(_currentUid: string, searchTerm: string): Promise<PublicProfile[]> {
  return api(`/api/data/search?q=${encodeURIComponent(searchTerm)}`);
}

export async function sendFriendRequestDoc(_from: PublicProfile, to: PublicProfile): Promise<void> {
  await api('/api/data/friend-requests', { body: { toUid: to.uid } });
}

export async function respondFriendRequestDoc(
  request: FriendRequestItem,
  decision: 'accepted' | 'rejected'
): Promise<void> {
  await api(`/api/data/friend-requests/${encodeURIComponent(request.id)}/respond`, { body: { decision } });
}

export async function cancelFriendRequestDoc(requestId: string): Promise<void> {
  await api(`/api/data/friend-requests/${encodeURIComponent(requestId)}`, { method: 'DELETE' });
}

export async function removeFriendshipDoc(friendshipId: string): Promise<void> {
  await api(`/api/data/friendships/${encodeURIComponent(friendshipId)}`, { method: 'DELETE' });
}

export async function createCallSessionDoc(params: {
  callId: string;
  roomCode: string;
  hostUid: string;
  hostName: string;
  callType: CallType;
  isPublicLink: boolean;
  invitedUid?: string;
}): Promise<void> {
  await api('/api/data/calls', {
    body: {
      callId: params.callId,
      roomCode: params.roomCode,
      callType: params.callType,
      isPublicLink: params.isPublicLink,
      invitedUid: params.invitedUid || '',
    },
  });
}

export async function updateCallSessionStatusDoc(
  callId: string,
  status: 'waiting' | 'ringing' | 'active' | 'ended',
  callType?: CallType
): Promise<void> {
  try {
    await api(`/api/data/calls/${encodeURIComponent(callId)}/status`, { method: 'PATCH', body: { status, callType } });
  } catch {
    // Ignore if the call record was already ended or belongs to preview mode
  }
}

export async function appendCallHistoryDoc(
  _uid: string,
  entry: Omit<CallHistoryItem, 'id' | 'ownerUid' | 'createdAtMs'>
): Promise<void> {
  await api('/api/data/call-history', { body: entry });
}

export async function deleteCallHistoryDoc(_uid: string, historyId: string): Promise<void> {
  await api(`/api/data/call-history/${encodeURIComponent(historyId)}`, { method: 'DELETE' });
}

export async function markNotificationReadDoc(_uid: string, notificationId: string): Promise<void> {
  await api(`/api/data/notifications/${encodeURIComponent(notificationId)}/read`, { method: 'POST', body: {} });
}

const POLL_MS = 4000;

/** Polls a list endpoint and pushes changes to the caller. */
function poll<T>(path: string, onUpdate: (items: T[]) => void): Unsubscribe {
  let stopped = false;
  let last = '';
  const tick = async () => {
    try {
      const items = await api<T[]>(path);
      const key = JSON.stringify(items);
      if (!stopped && key !== last) {
        last = key;
        onUpdate(items);
      }
    } catch {
      // transient errors are retried on the next tick
    }
  };
  void tick();
  const timer = window.setInterval(() => void tick(), POLL_MS);
  const onVisible = () => {
    if (document.visibilityState === 'visible') void tick();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

export const subscribeFriendships = (_uid: string, cb: (f: FriendContact[]) => void) =>
  poll<FriendContact>('/api/data/friendships', cb);
export const subscribeFriendRequests = (_uid: string, cb: (r: FriendRequestItem[]) => void) =>
  poll<FriendRequestItem>('/api/data/friend-requests', cb);
export const subscribeCallHistory = (_uid: string, cb: (i: CallHistoryItem[]) => void) =>
  poll<CallHistoryItem>('/api/data/call-history', cb);
export const subscribeNotifications = (_uid: string, cb: (i: NotificationItem[]) => void) =>
  poll<NotificationItem>('/api/data/notifications', cb);
export const subscribeDevices = (_uid: string, cb: (i: DeviceItem[]) => void) =>
  poll<DeviceItem>('/api/data/devices', cb);
