import {
  GoogleAuthProvider,
  onAuthStateChanged,
  getRedirectResult,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthError,
  type OAuthCredential,
  type Unsubscribe,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { auth, googleAuthProvider, oAuthClientId } from '../lib/firebase';

export { oAuthClientId };

export interface GoogleSignInResult {
  user: User;
  userCredential: UserCredential;
  credential: OAuthCredential | null;
  accessToken: string | null;
  idToken: string | null;
}

function assertOAuthClientConfigured(): void {
  if (!oAuthClientId) {
    throw new Error('Google OAuth Client ID is missing in Firebase configuration.');
  }
}

export function extractGoogleCredential(result: UserCredential): GoogleSignInResult {
  const credential = GoogleAuthProvider.credentialFromResult(result);
  return {
    user: result.user,
    userCredential: result,
    credential,
    accessToken: credential?.accessToken ?? null,
    idToken: credential?.idToken ?? null,
  };
}

export function extractGoogleCredentialFromError(error: unknown): OAuthCredential | null {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return GoogleAuthProvider.credentialFromError(error as AuthError);
  }
  return null;
}

function prefersRedirectSignIn(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isInApp = /FBAN|FBAV|Instagram|Line\/|; wv\)/.test(ua);
  return isIOS || isInApp;
}

let signInInFlight: Promise<GoogleSignInResult | null> | null = null;

/**
 * Popup on desktop/Android, redirect on iOS and in-app browsers.
 * Returns null when a redirect was started (the page will navigate away).
 * Concurrent calls share a single attempt.
 */
export function signInWithGoogle(): Promise<GoogleSignInResult | null> {
  if (signInInFlight) return signInInFlight;
  assertOAuthClientConfigured();
  googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
  signInInFlight = (async () => {
    try {
      if (prefersRedirectSignIn()) {
        await signInWithRedirect(auth, googleAuthProvider);
        return null;
      }
      const result = await signInWithPopup(auth, googleAuthProvider);
      return extractGoogleCredential(result);
    } finally {
      signInInFlight = null;
    }
  })();
  return signInInFlight;
}

export async function completeRedirectSignIn(): Promise<GoogleSignInResult | null> {
  const result = await getRedirectResult(auth);
  return result ? extractGoogleCredential(result) : null;
}

export async function signInWithGoogleCredential(
  idToken: string,
  accessToken?: string
): Promise<GoogleSignInResult> {
  assertOAuthClientConfigured();
  const cleanIdToken = idToken.trim();
  const cleanAccessToken = accessToken?.trim();
  if (!cleanIdToken && !cleanAccessToken) {
    throw new Error('Google ID token or access token is required for credential sign-in.');
  }
  const credential = GoogleAuthProvider.credential(
    cleanIdToken || null,
    cleanAccessToken || null
  );
  const result = await signInWithCredential(auth, credential);
  return extractGoogleCredential(result);
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuthState(callback: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, callback);
}
