import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  buildInitialUserRecords,
  clampDurationSeconds,
  isSafeMediaUrl,
  isValidHandle,
  sanitizeBio,
  sanitizeDisplayName,
  sanitizeHandle,
  sanitizeRoomCode,
} from '../utils/validation';
import type {
  CallHistoryItem,
  CallType,
  DeviceItem,
  FriendContact,
  FriendRequestItem,
  Language,
  NotificationItem,
  PresenceStatus,
  PublicProfile,
  Theme,
  UserPrivate,
} from '../types/app';

export async function ensureAuxProfileDocs(
  authUser: User,
  privateUser: UserPrivate,
  isNewUser: boolean
): Promise<PublicProfile> {
  const uid = authUser.uid;
  const publicPath = `publicProfiles/${uid}`;
  const initial = buildInitialUserRecords({
    uid,
    email: authUser.email,
    displayName: privateUser.displayName,
    photoURL: privateUser.photoURL,
    preferredLanguage: privateUser.preferredLanguage,
    preferredTheme: privateUser.preferredTheme,
  });

  let publicProfile: PublicProfile;
  try {
    const pubRef = doc(db, 'publicProfiles', uid);
    const pubSnap = await getDoc(pubRef);
    if (!pubSnap.exists()) {
      const payload = {
        ...initial.publicProfile,
        displayName: privateUser.displayName,
        photoURL: privateUser.photoURL,
        lastSeen: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(pubRef, payload);
      publicProfile = {
        ...initial.publicProfile,
        displayName: privateUser.displayName,
        photoURL: privateUser.photoURL,
      };
    } else {
      publicProfile = pubSnap.data() as PublicProfile;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, publicPath);
  }

  // Register active device
  const deviceId = `web_${typeof navigator !== 'undefined' && /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'}`;
  const platform: 'web' | 'ios' | 'android' =
    typeof navigator !== 'undefined' && /iPhone|iPad/i.test(navigator.userAgent)
      ? 'ios'
      : typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
        ? 'android'
        : 'web';
  const label =
    platform === 'ios'
      ? 'iPhone / iPad Safari'
      : platform === 'android'
        ? 'Android Browser'
        : 'Desktop Web Browser';

  try {
    const devRef = doc(db, 'users', uid, 'devices', deviceId);
    const devSnap = await getDoc(devRef);
    if (!devSnap.exists()) {
      await setDoc(devRef, {
        ownerUid: uid,
        label,
        platform,
        lastActiveAt: serverTimestamp(),
      });
    } else {
      await updateDoc(devRef, {
        label,
        platform,
        lastActiveAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}/devices/${deviceId}`);
  }

  // Create welcome notification upon first sign-in
  if (isNewUser) {
    const welcomeId = `welcome_${uid.slice(0, 12)}`;
    const notifPath = `users/${uid}/notifications/${welcomeId}`;
    try {
      const notifRef = doc(db, 'users', uid, 'notifications', welcomeId);
      const notifSnap = await getDoc(notifRef);
      if (!notifSnap.exists()) {
        await setDoc(notifRef, {
          ownerUid: uid,
          type: 'system',
          title:
            privateUser.preferredLanguage === 'ar'
              ? 'مرحباً بك في وصل'
              : 'Welcome to Wusul',
          body:
            privateUser.preferredLanguage === 'ar'
              ? 'تم إعداد ملفك الشخصي بنجاح. يمكنك الآن البحث عن الأصدقاء وبدء مكالمات الفيديو والصوت.'
              : 'Your profile is ready. Search for friends or start an instant video or voice call.',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, notifPath);
    }
  }

  return publicProfile;
}

export async function syncUserOnSignIn(
  authUser: User,
  defaultLang: Language,
  defaultTheme: Theme
): Promise<{ privateUser: UserPrivate; publicProfile: PublicProfile; isNewUser: boolean }> {
  const uid = authUser.uid;
  const userPath = `users/${uid}`;

  const initial = buildInitialUserRecords({
    uid,
    email: authUser.email,
    displayName: authUser.displayName,
    photoURL: authUser.photoURL,
    preferredLanguage: defaultLang,
    preferredTheme: defaultTheme,
  });

  let privateUser: UserPrivate;
  let isNewUser = false;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      isNewUser = true;
      await setDoc(userRef, {
        ...initial.privateUser,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      privateUser = initial.privateUser;
    } else {
      const data = snap.data() as UserPrivate;
      privateUser = {
        uid: data.uid,
        email: data.email,
        displayName: data.displayName,
        photoURL: data.photoURL,
        preferredLanguage: data.preferredLanguage || defaultLang,
        preferredTheme: data.preferredTheme || defaultTheme,
      };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  const publicProfile = await ensureAuxProfileDocs(authUser, privateUser, isNewUser);
  return { privateUser, publicProfile, isNewUser };
}

export async function updateUserPreferences(
  uid: string,
  prefs: { preferredLanguage?: Language; preferredTheme?: Theme }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      ...prefs,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function updatePresence(uid: string, presence: PresenceStatus): Promise<void> {
  const path = `publicProfiles/${uid}`;
  try {
    await updateDoc(doc(db, 'publicProfiles', uid), {
      presence,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function saveProfileEdits(
  uid: string,
  updates: {
    displayName: string;
    handle: string;
    bio: string;
    photoURL: string;
    isDiscoverable: boolean;
  }
): Promise<void> {
  const cleanName = sanitizeDisplayName(updates.displayName);
  const cleanHandle = sanitizeHandle(updates.handle);
  const cleanBio = sanitizeBio(updates.bio);
  const cleanPhoto = isSafeMediaUrl(updates.photoURL) ? updates.photoURL : '';

  if (!cleanName || !isValidHandle(cleanHandle)) {
    throw new Error('Invalid display name or handle format.');
  }

  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: cleanName,
      photoURL: cleanPhoto,
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'publicProfiles', uid), {
      displayName: cleanName,
      handle: cleanHandle,
      bio: cleanBio,
      photoURL: cleanPhoto,
      isDiscoverable: updates.isDiscoverable,
      lastSeen: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `publicProfiles/${uid}`);
  }
}

export async function searchPublicDirectory(
  currentUid: string,
  searchTerm: string
): Promise<PublicProfile[]> {
  const path = 'publicProfiles';
  try {
    const q = query(
      collection(db, 'publicProfiles'),
      where('isDiscoverable', '==', true),
      limit(40)
    );
    const snap = await getDocs(q);
    const term = searchTerm.trim().toLowerCase();
    const results: PublicProfile[] = [];
    snap.forEach((docSnap) => {
      const p = docSnap.data() as PublicProfile;
      if (p.uid === currentUid) return;
      if (
        !term ||
        p.displayName.toLowerCase().includes(term) ||
        p.handle.toLowerCase().includes(term) ||
        p.bio.toLowerCase().includes(term)
      ) {
        results.push(p);
      }
    });
    return results;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function sendFriendRequestDoc(
  fromProfile: PublicProfile,
  toProfile: PublicProfile
): Promise<void> {
  const reqId = `${fromProfile.uid}_${toProfile.uid}`.slice(0, 128);
  const path = `friendRequests/${reqId}`;
  try {
    await setDoc(doc(db, 'friendRequests', reqId), {
      fromUid: fromProfile.uid,
      toUid: toProfile.uid,
      fromName: sanitizeDisplayName(fromProfile.displayName) || 'User',
      fromHandle: sanitizeHandle(fromProfile.handle) || 'user',
      fromPhoto: fromProfile.photoURL || '',
      toName: sanitizeDisplayName(toProfile.displayName) || 'User',
      toHandle: sanitizeHandle(toProfile.handle) || 'user',
      toPhoto: toProfile.photoURL || '',
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function respondFriendRequestDoc(
  request: FriendRequestItem,
  decision: 'accepted' | 'rejected'
): Promise<void> {
  const path = `friendRequests/${request.id}`;
  try {
    await updateDoc(doc(db, 'friendRequests', request.id), {
      status: decision,
      updatedAt: serverTimestamp(),
    });
    if (decision === 'accepted') {
      const [userA, userB] = [request.fromUid, request.toUid].sort();
      const isFromA = userA === request.fromUid;
      const friendshipId = `${userA}_${userB}`.slice(0, 128);
      await setDoc(doc(db, 'friendships', friendshipId), {
        userA,
        userB,
        userAName: isFromA ? request.fromName : request.toName,
        userBName: isFromA ? request.toName : request.fromName,
        userAPhoto: isFromA ? request.fromPhoto : request.toPhoto,
        userBPhoto: isFromA ? request.toPhoto : request.fromPhoto,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function cancelFriendRequestDoc(requestId: string): Promise<void> {
  const path = `friendRequests/${requestId}`;
  try {
    await deleteDoc(doc(db, 'friendRequests', requestId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function removeFriendshipDoc(friendshipId: string): Promise<void> {
  const path = `friendships/${friendshipId}`;
  try {
    await deleteDoc(doc(db, 'friendships', friendshipId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
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
  const path = `calls/${params.callId}`;
  const cleanCode = sanitizeRoomCode(params.roomCode);
  try {
    await setDoc(doc(db, 'calls', params.callId), {
      roomCode: cleanCode,
      hostUid: params.hostUid,
      hostName: sanitizeDisplayName(params.hostName) || 'Host',
      callType: params.callType,
      status: params.isPublicLink ? 'waiting' : 'ringing',
      isPublicLink: params.isPublicLink,
      invitedUid: params.invitedUid || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateCallSessionStatusDoc(
  callId: string,
  status: 'waiting' | 'ringing' | 'active' | 'ended',
  callType?: CallType
): Promise<void> {
  const path = `calls/${callId}`;
  try {
    const patch: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (callType) patch.callType = callType;
    await updateDoc(doc(db, 'calls', callId), patch);
  } catch {
    // Ignore if call doc was already ended or belongs to preview mode
  }
}

export async function appendCallHistoryDoc(
  uid: string,
  entry: Omit<CallHistoryItem, 'id' | 'ownerUid' | 'createdAtMs'>
): Promise<void> {
  const historyId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `users/${uid}/callHistory/${historyId}`;
  try {
    await setDoc(doc(db, 'users', uid, 'callHistory', historyId), {
      ownerUid: uid,
      peerUid: entry.peerUid.slice(0, 128),
      peerName: sanitizeDisplayName(entry.peerName) || 'Participant',
      peerPhoto: isSafeMediaUrl(entry.peerPhoto) ? entry.peerPhoto : '',
      callType: entry.callType,
      direction: entry.direction,
      status: entry.status,
      durationSeconds: clampDurationSeconds(entry.durationSeconds),
      roomCode: sanitizeRoomCode(entry.roomCode || 'ROOM'),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteCallHistoryDoc(uid: string, historyId: string): Promise<void> {
  const path = `users/${uid}/callHistory/${historyId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'callHistory', historyId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function markNotificationReadDoc(uid: string, notificationId: string): Promise<void> {
  const path = `users/${uid}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'notifications', notificationId), {
      read: true,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export function subscribeFriendships(
  uid: string,
  onUpdate: (friends: FriendContact[]) => void
): Unsubscribe {
  let listA: Array<{ id: string; peerUid: string; name: string; photo: string }> = [];
  let listB: Array<{ id: string; peerUid: string; name: string; photo: string }> = [];

  const emitMerged = async () => {
    const combined = [...listA, ...listB];
    const resolved = await Promise.all(
      combined.map(async (item) => {
        try {
          const snap = await getDoc(doc(db, 'publicProfiles', item.peerUid));
          if (snap.exists()) {
            const p = snap.data() as PublicProfile;
            return {
              friendshipId: item.id,
              uid: p.uid,
              displayName: p.displayName,
              handle: p.handle,
              bio: p.bio,
              photoURL: p.photoURL,
              presence: p.presence,
            } as FriendContact;
          }
        } catch {
          // Fallback to snapshot metadata
        }
        return {
          friendshipId: item.id,
          uid: item.peerUid,
          displayName: item.name,
          handle: 'friend',
          bio: '',
          photoURL: item.photo,
          presence: 'offline' as PresenceStatus,
        };
      })
    );
    onUpdate(resolved);
  };

  const qA = query(collection(db, 'friendships'), where('userA', '==', uid));
  const qB = query(collection(db, 'friendships'), where('userB', '==', uid));

  const unsubA = onSnapshot(
    qA,
    (snap) => {
      listA = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, peerUid: data.userB, name: data.userBName, photo: data.userBPhoto };
      });
      void emitMerged();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
  );

  const unsubB = onSnapshot(
    qB,
    (snap) => {
      listB = snap.docs.map((d) => {
        const data = d.data();
        return { id: d.id, peerUid: data.userA, name: data.userAName, photo: data.userAPhoto };
      });
      void emitMerged();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'friendships')
  );

  return () => {
    unsubA();
    unsubB();
  };
}

export function subscribeFriendRequests(
  uid: string,
  onUpdate: (requests: FriendRequestItem[]) => void
): Unsubscribe {
  let incoming: FriendRequestItem[] = [];
  let outgoing: FriendRequestItem[] = [];

  const emit = () => {
    const map = new Map<string, FriendRequestItem>();
    [...incoming, ...outgoing].forEach((r) => map.set(r.id, r));
    onUpdate(Array.from(map.values()).sort((a, b) => b.createdAtMs - a.createdAtMs));
  };

  const mapDoc = (id: string, data: Record<string, unknown>): FriendRequestItem => ({
    id,
    fromUid: String(data.fromUid || ''),
    toUid: String(data.toUid || ''),
    fromName: String(data.fromName || ''),
    fromHandle: String(data.fromHandle || ''),
    fromPhoto: String(data.fromPhoto || ''),
    toName: String(data.toName || ''),
    toHandle: String(data.toHandle || ''),
    toPhoto: String(data.toPhoto || ''),
    status: (data.status as FriendRequestItem['status']) || 'pending',
    createdAtMs:
      data.createdAt && typeof (data.createdAt as { toMillis?: () => number }).toMillis === 'function'
        ? (data.createdAt as { toMillis: () => number }).toMillis()
        : Date.now(),
  });

  const qIn = query(collection(db, 'friendRequests'), where('toUid', '==', uid));
  const qOut = query(collection(db, 'friendRequests'), where('fromUid', '==', uid));

  const unsubIn = onSnapshot(
    qIn,
    (snap) => {
      incoming = snap.docs.map((d) => mapDoc(d.id, d.data()));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
  );

  const unsubOut = onSnapshot(
    qOut,
    (snap) => {
      outgoing = snap.docs.map((d) => mapDoc(d.id, d.data()));
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'friendRequests')
  );

  return () => {
    unsubIn();
    unsubOut();
  };
}

export function subscribeCallHistory(
  uid: string,
  onUpdate: (items: CallHistoryItem[]) => void
): Unsubscribe {
  const path = `users/${uid}/callHistory`;
  const q = query(
    collection(db, 'users', uid, 'callHistory'),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerUid: String(data.ownerUid),
          peerUid: String(data.peerUid),
          peerName: String(data.peerName),
          peerPhoto: String(data.peerPhoto || ''),
          callType: data.callType as CallType,
          direction: data.direction as 'outgoing' | 'incoming',
          status: data.status as CallHistoryItem['status'],
          durationSeconds: Number(data.durationSeconds || 0),
          roomCode: String(data.roomCode || ''),
          createdAtMs:
            data.createdAt && typeof data.createdAt.toMillis === 'function'
              ? data.createdAt.toMillis()
              : Date.now(),
        };
      });
      onUpdate(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeNotifications(
  uid: string,
  onUpdate: (items: NotificationItem[]) => void
): Unsubscribe {
  const path = `users/${uid}/notifications`;
  const q = query(
    collection(db, 'users', uid, 'notifications'),
    where('ownerUid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerUid: String(data.ownerUid),
          type: data.type as NotificationItem['type'],
          title: String(data.title),
          body: String(data.body),
          read: Boolean(data.read),
          createdAtMs:
            data.createdAt && typeof data.createdAt.toMillis === 'function'
              ? data.createdAt.toMillis()
              : Date.now(),
        };
      });
      onUpdate(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeDevices(
  uid: string,
  onUpdate: (items: DeviceItem[]) => void
): Unsubscribe {
  const path = `users/${uid}/devices`;
  const q = query(collection(db, 'users', uid, 'devices'), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          ownerUid: String(data.ownerUid),
          label: String(data.label),
          platform: data.platform as DeviceItem['platform'],
          lastActiveAtMs:
            data.lastActiveAt && typeof data.lastActiveAt.toMillis === 'function'
              ? data.lastActiveAt.toMillis()
              : Date.now(),
        };
      });
      onUpdate(items);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}
