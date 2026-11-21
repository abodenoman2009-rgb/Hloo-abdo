import { useState } from 'react';
import { Copy, Laptop, Smartphone } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { STUDIO_AVATARS } from '../data/seedData';
import { t } from '../i18n/translations';
import { isValidHandle, sanitizeBio, sanitizeDisplayName, sanitizeHandle } from '../utils/validation';
import { Avatar } from './Avatar';

export function ProfileView() {
  const {
    language,
    sessionUser,
    privateUser,
    publicProfile,
    devices,
    saveProfile,
    showToast,
  } = useApp();

  const [displayName, setDisplayName] = useState(
    publicProfile?.displayName || privateUser?.displayName || ''
  );
  const [handle, setHandle] = useState(publicProfile?.handle || 'user');
  const [bio, setBio] = useState(publicProfile?.bio || '');
  const [photoURL, setPhotoURL] = useState(
    publicProfile?.photoURL || privateUser?.photoURL || STUDIO_AVATARS[0]
  );
  const [isDiscoverable, setIsDiscoverable] = useState(
    publicProfile?.isDiscoverable ?? true
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const personalRoomCode = (publicProfile?.handle || 'WUSUL')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10) || 'WUSUL';
  const personalLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/?room=${personalRoomCode}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanName = sanitizeDisplayName(displayName);
    const cleanHandle = sanitizeHandle(handle);
    const cleanBio = sanitizeBio(bio);
    if (!cleanName || !isValidHandle(cleanHandle)) {
      setErrorMsg(
        language === 'ar'
          ? 'يرجى إدخال اسم صالح ومعرّف إنجليزي من حرفين على الأقل.'
          : 'Please enter a valid name and a handle of at least 2 characters.'
      );
      return;
    }

    setSaving(true);
    try {
      await saveProfile({
        displayName: cleanName,
        handle: cleanHandle,
        bio: cleanBio,
        photoURL,
        isDiscoverable,
      });
      showToast(t(language, 'profileSaved'));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t(language, 'errorGeneric'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPersonalLink = async () => {
    try {
      await navigator.clipboard.writeText(personalLink);
    } catch {
      // Ignore clipboard failure
    }
    showToast(t(language, 'linkCopied'));
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t(language, 'profileTitle')}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <Avatar src={photoURL} name={displayName || 'User'} size="xl" presence="online" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {t(language, 'avatarGalleryLabel')}
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {STUDIO_AVATARS.map((url, idx) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setPhotoURL(url)}
                  aria-label={`Portrait ${idx + 1}`}
                  className={`w-11 h-11 rounded-full overflow-hidden border-2 transition-transform ${
                    photoURL === url
                      ? 'border-teal-600 scale-105'
                      : 'border-transparent opacity-80 hover:opacity-100'
                  }`}
                >
                  <img
                    src={url}
                    alt={`Portrait ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
          >
            {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="profile-name"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              {t(language, 'displayNameLabel')}
            </label>
            <input
              id="profile-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              required
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="profile-handle"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              {t(language, 'handleLabel')}
            </label>
            <input
              id="profile-handle"
              type="text"
              dir="ltr"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              maxLength={40}
              required
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="profile-bio"
            className="block text-xs font-medium text-slate-600 dark:text-slate-400"
          >
            {t(language, 'bioLabel')}
          </label>
          <textarea
            id="profile-bio"
            rows={2}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {t(language, 'discoverableLabel')}
          </span>
          <input
            type="checkbox"
            checked={isDiscoverable}
            onChange={(e) => setIsDiscoverable(e.target.checked)}
            className="w-5 h-5 accent-teal-700 rounded"
          />
        </label>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[48px] px-6 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-semibold text-sm transition-colors whitespace-nowrap"
          >
            {t(language, 'saveProfile')}
          </button>
        </div>
      </form>

      {/* Personal Shareable Call Link */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t(language, 'personalLinkLabel')}
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            readOnly
            dir="ltr"
            value={personalLink}
            aria-label={t(language, 'personalLinkLabel')}
            className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-xs font-mono text-slate-600 dark:text-slate-300"
          />
          <button
            type="button"
            onClick={() => void handleCopyPersonalLink()}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <Copy className="w-4 h-4" />
            <span>{t(language, 'shareRoomLink')}</span>
          </button>
        </div>
      </section>

      {/* Registered Devices */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 space-y-3">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          {t(language, 'devicesListTitle')}
        </h2>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {devices.map((dev) => (
            <div key={dev.id} className="py-3 flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                {dev.platform === 'web' ? (
                  <Laptop className="w-4 h-4 text-slate-400" />
                ) : (
                  <Smartphone className="w-4 h-4 text-slate-400" />
                )}
                <span>{dev.label}</span>
              </div>
              <span className="text-xs font-mono text-slate-400 uppercase">{dev.platform}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
