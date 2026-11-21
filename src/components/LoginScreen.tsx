import { useState } from 'react';
import { Globe, Moon, Sun, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { sendResetEmail, signInWithEmail, signUpWithEmail } from '../services/auth';
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
  const [info, setInfo] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const isBusy = signingIn || authLoading;
  const activeError = localError || authError;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBusy) return;
    setLocalError(null);
    setInfo(null);
    setSigningIn(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name);
        setInfo(t(language, 'verifySent'));
        setMode('signin');
        setPassword('');
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err) {
      setLocalError(mapFirebaseAuthErrorMessage(err, language));
    } finally {
      setSigningIn(false);
    }
  };

  const handleReset = async () => {
    if (isBusy) return;
    setLocalError(null);
    setInfo(null);
    if (!email.trim()) {
      setLocalError(mapFirebaseAuthErrorMessage({ code: 'auth/invalid-email' }, language));
      return;
    }
    setSigningIn(true);
    try {
      await sendResetEmail(email);
      setInfo(t(language, 'resetSent'));
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
              <span>Email &amp; Password</span>
              <span aria-hidden="true">·</span>
              <span>iPhone &amp; Android Web</span>
            </div>
          </section>

          <section className="lg:col-span-5">
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-7 sm:p-8 space-y-6">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {t(language, 'emailPasswordTitle')}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t(language, 'emailPasswordNotice')}
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

              {info && (
                <div
                  role="status"
                  className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50 dark:bg-teal-950/40 px-4 py-3 text-sm text-teal-800 dark:text-teal-300"
                >
                  {info}
                </div>
              )}

              <form onSubmit={(e) => void handleEmailSubmit(e)} className="space-y-3">
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <label htmlFor="auth-name" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                      {t(language, 'nameLabel')}
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={60}
                      className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label htmlFor="auth-email" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t(language, 'emailLabel')}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    dir="ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="auth-password" className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    {t(language, 'passwordLabel')}
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-3 transition-colors whitespace-nowrap"
                >
                  <span>
                    {isBusy
                      ? t(language, 'signingIn')
                      : mode === 'signup'
                        ? t(language, 'signUpBtn')
                        : t(language, 'signInBtn')}
                  </span>
                </button>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin');
                      setLocalError(null);
                      setInfo(null);
                    }}
                    className="min-h-[36px] text-teal-700 dark:text-teal-400 hover:underline"
                  >
                    {mode === 'signin' ? t(language, 'noAccountYet') : t(language, 'haveAccount')}
                  </button>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => void handleReset()}
                      className="min-h-[36px] text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      {t(language, 'forgotPassword')}
                    </button>
                  )}
                </div>
              </form>

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
