// Field bounds & patterns shared by the client and the server

export const FIELD_LIMITS = {
  UID_MAX: 128,
  EMAIL_MAX: 254,
  DISPLAY_NAME_MAX: 80,
  HANDLE_MIN: 2,
  HANDLE_MAX: 40,
  BIO_MAX: 200,
  PHOTO_URL_MAX: 512,
  ROOM_CODE_MIN: 4,
  ROOM_CODE_MAX: 24,
  MAX_CALL_DURATION_SECONDS: 86400,
  NOTIFICATION_TITLE_MAX: 120,
  NOTIFICATION_BODY_MAX: 300,
  DEVICE_LABEL_MAX: 100,
} as const;

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;
const VALID_HANDLE_REGEX = /^[a-zA-Z0-9_.-]{2,40}$/;
const VALID_ROOM_CODE_REGEX = /^[A-Z0-9-]{4,24}$/;

export function isValidId(value: string): boolean {
  return typeof value === 'string' && VALID_ID_REGEX.test(value);
}

export function isValidHandle(value: string): boolean {
  return typeof value === 'string' && VALID_HANDLE_REGEX.test(value);
}

export function isValidRoomCodeFormat(value: string): boolean {
  return typeof value === 'string' && VALID_ROOM_CODE_REGEX.test(value);
}

export function sanitizeDisplayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return trimmed.slice(0, FIELD_LIMITS.DISPLAY_NAME_MAX);
}

export function sanitizeHandle(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, FIELD_LIMITS.HANDLE_MAX);
  return cleaned;
}

export function deriveDefaultHandle(emailOrName: string, uid: string): string {
  const base = emailOrName.split('@')[0] || 'user';
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, '')
    .slice(0, 24);
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase() || '01';
  const candidate = cleaned.length >= 2 ? `${cleaned}_${suffix}` : `user_${suffix}`;
  return candidate.slice(0, FIELD_LIMITS.HANDLE_MAX);
}

export function sanitizeBio(raw: string): string {
  return raw.trim().slice(0, FIELD_LIMITS.BIO_MAX);
}

export function sanitizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, FIELD_LIMITS.ROOM_CODE_MAX);
}

export function isSafeMediaUrl(url: string): boolean {
  if (!url) return true;
  if (url.length > FIELD_LIMITS.PHOTO_URL_MAX) return false;
  if (url.startsWith('/src/assets/')) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function clampDurationSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds < 0) return 0;
  return Math.min(Math.floor(seconds), FIELD_LIMITS.MAX_CALL_DURATION_SECONDS);
}

export function buildInitialUserRecords(params: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  preferredLanguage: 'ar' | 'en';
  preferredTheme: 'light' | 'dark';
}): {
  privateUser: {
    uid: string;
    email: string;
    displayName: string;
    photoURL: string;
    preferredLanguage: 'ar' | 'en';
    preferredTheme: 'light' | 'dark';
  };
  publicProfile: {
    uid: string;
    displayName: string;
    handle: string;
    bio: string;
    photoURL: string;
    presence: 'online';
    isDiscoverable: boolean;
  };
} {
  if (!isValidId(params.uid)) {
    throw new Error('Invalid authenticated user UID');
  }
  const safeEmail = (params.email || 'user@example.com').trim().slice(0, FIELD_LIMITS.EMAIL_MAX);
  const fallbackName = safeEmail.split('@')[0] || 'Wusul User';
  const safeName =
    sanitizeDisplayName(params.displayName || fallbackName) || 'Wusul User';
  const safePhoto = isSafeMediaUrl(params.photoURL || '')
    ? (params.photoURL || '').slice(0, FIELD_LIMITS.PHOTO_URL_MAX)
    : '';
  const handle = deriveDefaultHandle(safeEmail, params.uid);

  return {
    privateUser: {
      uid: params.uid,
      email: safeEmail,
      displayName: safeName,
      photoURL: safePhoto,
      preferredLanguage: params.preferredLanguage,
      preferredTheme: params.preferredTheme,
    },
    publicProfile: {
      uid: params.uid,
      displayName: safeName,
      handle,
      bio: '',
      photoURL: safePhoto,
      presence: 'online',
      isDiscoverable: true,
    },
  };
}

export function mapAuthErrorMessage(
  error: unknown,
  language: 'ar' | 'en'
): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const m = (ar: string, en: string) => (language === 'ar' ? ar : en);

  if (code === 'auth/invalid-credential') {
    return m('البريد الإلكتروني أو كلمة المرور غير صحيحة.', 'Incorrect email or password.');
  }
  if (code === 'auth/email-already-in-use') {
    return m('هذا البريد مسجل مسبقاً. سجّل الدخول بدلاً من ذلك.', 'This email is already registered. Sign in instead.');
  }
  if (code === 'auth/weak-password') {
    return m('كلمة المرور ضعيفة. استخدم 8 أحرف على الأقل.', 'Password is too weak. Use at least 8 characters.');
  }
  if (code === 'auth/invalid-email') {
    return m('صيغة البريد الإلكتروني غير صحيحة.', 'The email address is not valid.');
  }
  if (code === 'auth/too-many-requests' || code === 'http/429') {
    return m('محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.', 'Too many attempts. Wait a moment and try again.');
  }
  if (code === 'auth/network-request-failed') {
    return m('تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت وحاول مجدداً.', 'Network error. Check your connection and try again.');
  }

  return error instanceof Error && error.message
    ? error.message
    : m('فشل تسجيل الدخول.', 'Sign-in failed.');
}
