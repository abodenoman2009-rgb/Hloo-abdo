import { useState } from 'react';
import { Globe, Moon, Sun, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { oAuthClientId, signInWithGoogle } from '../services/auth';
import { mapFirebaseAuthErrorMessage, sanitizeRoomCode } from '../utils/validation';

export function LoginScreen() {
  const {
    language,
    theme,
    setLanguage,
    setTheme,
    authLoading,
    authError,
  } = useApp();

  const [roomInput, setRoomInput] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const isBusy = signingIn || authLoading;
  const activeError = localError || authError;

  const triggerGoogleSignIn = async () => {
    setLocalError(null);
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setLocalError(mapFirebaseAuthErrorMessage(err, language));
    } finally {
      setSigningIn(false);
    }
  };

  const handleRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeRoomCode(roomInput);
    if (cleaned.length >= 4) {
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleaned);
      window.history.replaceState({}, '', url.toString());
    }
    void triggerGoogleSignIn();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FA] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <span className="w-10 h-10 rounded-xl bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center">
            <Video className="w-5 h-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">
            {t(language, 'brand')}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
            aria-label={language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] text-xs font-medium flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Globe className="w-4 h-4 text-teal-700 dark:text-teal-400" />
            <span>{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? t(language, 'themeLight') : t(language, 'themeDark')}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <section className="lg:col-span-7 space-y-6">
            <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
              {t(language, 'tagline')}
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold leading-tight text-balance text-slate-900 dark:text-white">
              {t(language, 'signInTitle')}
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
              {t(language, 'signInSubtitle')}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              <span>WebRTC HD</span>
              <span aria-hidden="true">·</span>
              <span>STUN / TURN</span>
              <span aria-hidden="true">·</span>
              <span>Google OAuth 2.0</span>
              <span aria-hidden="true">·</span>
              <span>iPhone &amp; Android Web</span>
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-7 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {t(language, 'continueWithGoogle')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(language, 'authNotice')}
                </p>
              </div>

              {activeError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
                >
                  {activeError}
                </div>
              )}

              <button
                type="button"
                disabled={isBusy || !oAuthClientId}
                onClick={() => void triggerGoogleSignIn()}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors whitespace-nowrap"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
                <span>
                  {isBusy ? t(language, 'signingIn') : t(language, 'continueWithGoogle')}
                </span>
              </button>

              <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
                <form onSubmit={handleRoomSubmit} className="space-y-3">
                  <label
                    htmlFor="login-room-code"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    {t(language, 'joinRoomQuickTitle')}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="login-room-code"
                      type="text"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                      placeholder={t(language, 'roomCodePlaceholder')}
                      dir="ltr"
                      className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      type="submit"
                      disabled={isBusy}
                      className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-60 text-sm font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      {t(language, 'joinRoomBtn')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
