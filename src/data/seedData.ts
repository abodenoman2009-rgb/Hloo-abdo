import type {
  CallHistoryItem,
  DeviceItem,
  FriendContact,
  FriendRequestItem,
  NotificationItem,
  PublicProfile,
  UserPrivate,
} from '../types/app';

export const STUDIO_AVATARS = [
  '/src/assets/images/avatar_layla_1795287157992.jpg',
  '/src/assets/images/avatar_tariq_1795287159092.jpg',
  '/src/assets/images/avatar_nora_1795287159038.jpg',
  '/src/assets/images/avatar_omar_1795287157850.jpg',
] as const;

export const PREVIEW_USER: UserPrivate = {
  uid: 'preview_user_01',
  email: 'abodenoman2004@gmail.com',
  displayName: 'عبدالله نعمان',
  photoURL: STUDIO_AVATARS[3],
  preferredLanguage: 'ar',
  preferredTheme: 'dark',
};

export const PREVIEW_PUBLIC_PROFILE: PublicProfile = {
  uid: 'preview_user_01',
  displayName: 'عبدالله نعمان',
  handle: 'abode_noman',
  bio: 'مهندس برمجيات واتصالات سحابية',
  photoURL: STUDIO_AVATARS[3],
  presence: 'online',
  isDiscoverable: true,
};

export const PREVIEW_FRIENDS: FriendContact[] = [
  {
    friendshipId: 'fr_layla',
    uid: 'user_layla',
    displayName: 'ليلى المنصور',
    handle: 'layla.arch',
    bio: 'معمارية أنظمة وتطوير واجهات',
    photoURL: STUDIO_AVATARS[0],
    presence: 'online',
  },
  {
    friendshipId: 'fr_tariq',
    uid: 'user_tariq',
    displayName: 'طارق زيد',
    handle: 'tariq.design',
    bio: 'مصمم منتجات رقمية',
    photoURL: STUDIO_AVATARS[1],
    presence: 'online',
  },
  {
    friendshipId: 'fr_nora',
    uid: 'user_nora',
    displayName: 'نورة العلي',
    handle: 'nora.studio',
    bio: 'مديرة إبداعية ومحتوى مرئي',
    photoURL: STUDIO_AVATARS[2],
    presence: 'in-call',
  },
];

export const PREVIEW_DIRECTORY: PublicProfile[] = [
  {
    uid: 'user_layla',
    displayName: 'ليلى المنصور',
    handle: 'layla.arch',
    bio: 'معمارية أنظمة وتطوير واجهات',
    photoURL: STUDIO_AVATARS[0],
    presence: 'online',
    isDiscoverable: true,
  },
  {
    uid: 'user_tariq',
    displayName: 'طارق زيد',
    handle: 'tariq.design',
    bio: 'مصمم منتجات رقمية',
    photoURL: STUDIO_AVATARS[1],
    presence: 'online',
  isDiscoverable: true,
  },
  {
    uid: 'user_nora',
    displayName: 'نورة العلي',
    handle: 'nora.studio',
    bio: 'مديرة إبداعية ومحتوى مرئي',
    photoURL: STUDIO_AVATARS[2],
    presence: 'in-call',
    isDiscoverable: true,
  },
  {
    uid: 'user_karim',
    displayName: 'كريم الحسن',
    handle: 'karim.cloud',
    bio: 'مهندس شبكات واتصالات فورية',
    photoURL: STUDIO_AVATARS[3],
    presence: 'online',
    isDiscoverable: true,
  },
];

export const PREVIEW_REQUESTS: FriendRequestItem[] = [
  {
    id: 'req_karim_01',
    fromUid: 'user_karim',
    toUid: 'preview_user_01',
    fromName: 'كريم الحسن',
    fromHandle: 'karim.cloud',
    fromPhoto: STUDIO_AVATARS[3],
    toName: 'عبدالله نعمان',
    toHandle: 'abode_noman',
    toPhoto: STUDIO_AVATARS[3],
    status: 'pending',
    createdAtMs: Date.now() - 1000 * 60 * 18,
  },
];

export const PREVIEW_HISTORY: CallHistoryItem[] = [
  {
    id: 'hist_1',
    ownerUid: 'preview_user_01',
    peerUid: 'user_layla',
    peerName: 'ليلى المنصور',
    peerPhoto: STUDIO_AVATARS[0],
    callType: 'video',
    direction: 'outgoing',
    status: 'completed',
    durationSeconds: 842,
    roomCode: 'WRK-8241',
    createdAtMs: Date.now() - 1000 * 60 * 45,
  },
  {
    id: 'hist_2',
    ownerUid: 'preview_user_01',
    peerUid: 'user_tariq',
    peerName: 'طارق زيد',
    peerPhoto: STUDIO_AVATARS[1],
    callType: 'voice',
    direction: 'incoming',
    status: 'missed',
    durationSeconds: 0,
    roomCode: 'DSG-3190',
    createdAtMs: Date.now() - 1000 * 60 * 190,
  },
  {
    id: 'hist_3',
    ownerUid: 'preview_user_01',
    peerUid: 'user_nora',
    peerName: 'نورة العلي',
    peerPhoto: STUDIO_AVATARS[2],
    callType: 'video',
    direction: 'incoming',
    status: 'completed',
    durationSeconds: 1510,
    roomCode: 'NRA-4402',
    createdAtMs: Date.now() - 1000 * 60 * 60 * 22,
  },
];

export const PREVIEW_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_1',
    ownerUid: 'preview_user_01',
    type: 'friend_request',
    title: 'طلب صداقة جديد',
    body: 'أرسل كريم الحسن (@karim.cloud) طلب صداقة للاتصال المباشر.',
    read: false,
    createdAtMs: Date.now() - 1000 * 60 * 18,
  },
  {
    id: 'notif_2',
    ownerUid: 'preview_user_01',
    type: 'missed_call',
    title: 'مكالمة صوتية فائتة',
    body: 'حاول طارق زيد الاتصال بك في الغرفة DSG-3190.',
    read: false,
    createdAtMs: Date.now() - 1000 * 60 * 190,
  },
];

export const PREVIEW_DEVICES: DeviceItem[] = [
  {
    id: 'dev_web_current',
    ownerUid: 'preview_user_01',
    label: 'Web Browser (Current Session)',
    platform: 'web',
    lastActiveAtMs: Date.now(),
  },
];
