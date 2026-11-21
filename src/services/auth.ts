import { api, ApiError } from '../lib/api';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

/** Returns the signed-in user for the current session cookie, or null. */
export async function fetchSession(): Promise<AppUser | null> {
  try {
    return await api<AppUser>('/api/auth/me');
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  prefs: { preferredLanguage: 'ar' | 'en'; preferredTheme: 'light' | 'dark' }
): Promise<AppUser> {
  await api('/api/auth/register', {
    body: { email: email.trim(), password, displayName: displayName.trim(), ...prefs },
  });
  return (await fetchSession()) as AppUser;
}

export async function signInWithEmail(email: string, password: string): Promise<AppUser> {
  await api('/api/auth/login', { body: { email: email.trim(), password } });
  return (await fetchSession()) as AppUser;
}

export async function signOutUser(): Promise<void> {
  await api('/api/auth/logout', { method: 'POST', body: {} });
}

export async function getWsTicket(): Promise<string> {
  return (await api<{ ticket: string }>('/api/auth/ws-ticket', { method: 'POST', body: {} })).ticket;
}
