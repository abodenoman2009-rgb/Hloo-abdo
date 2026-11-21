import { useState } from 'react';
import { ArrowUpRight, Link2, Phone, PhoneIncoming, PhoneMissed, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { formatCallDuration, sortContactsByPresence } from '../utils/callLogic';
import { sanitizeRoomCode } from '../utils/validation';
import { Avatar } from './Avatar';

export function HomeView() {
  const {
    language,
    publicProfile,
    friends,
    callHistory,
    onlineUids,
    busyUids,
    isPreviewMode,
    setActiveTab,
    startDirectCall,
    createShareableRoom,
    joinRoomByCode,
    simulateIncomingPreviewCall,
    showToast,
  } = useApp();

  const [roomCodeInput, setRoomCodeInput] = useState('');

  const resolvedFriends = sortContactsByPresence(
    friends.map((f) => ({
      ...f,
      presence: busyUids.has(f.uid)
        ? 'in-call'
        : onlineUids.has(f.uid)
          ? 'online'
          : f.presence,
    }))
  );

  const onlineFriends = resolvedFriends.filter((f) => f.presence !== 'offline');
  const recentCalls = callHistory.slice(0, 4);

  const handleCreateRoom = async (type: 'video' | 'voice') => {
    const code = await createShareableRoom(type);
    const link = `${window.location.origin}/?room=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast(`${t(language, 'linkCopied')} (${code})`);
    } catch {
      showToast(`${t(language, 'roomCodeLabel')}: ${code}`);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = sanitizeRoomCode(roomCodeInput);
    if (cleaned.length < 4) return;
    void joinRoomByCode(cleaned, 'video');
    setRoomCodeInput('');
  };

  const presenceLabel = (p: string) => {
    if (p === 'online') return t(language, 'presenceOnline');
    if (p === 'in-call') return t(language, 'presenceInCall');
    if (p === 'busy') return t(language, 'presenceBusy');
    return t(language, 'presenceOffline');
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t(language, 'greetingPrefix')}
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white mt-0.5">
            {publicProfile?.displayName || t(language, 'brand')}
          </h1>
        </div>

        {isPreviewMode && (
          <button
            type="button"
            onClick={simulateIncomingPreviewCall}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131924] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            {t(language, 'simulateIncomingBtn')}
          </button>
        )}
      </header>

      {/* Primary Call Launcher */}
      <section
        aria-label={t(language, 'quickActionsTitle')}
        className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
      >
        <div className="lg:col-span-7 space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t(language, 'quickActionsTitle')}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {t(language, 'createRoomHint')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleCreateRoom('video')}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm flex items-center gap-2.5 transition-colors whitespace-nowrap"
            >
              <Video className="w-4 h-4 shrink-0" />
              <span>{t(language, 'newVideoRoom')}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleCreateRoom('voice')}
              className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-sm flex items-center gap-2.5 transition-colors whitespace-nowrap"
            >
              <Phone className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
              <span>{t(language, 'newVoiceRoom')}</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleJoinRoom}
          className="lg:col-span-5 border-t lg:border-t-0 lg:border-s border-slate-200 dark:border-slate-800 pt-6 lg:pt-0 lg:ps-8 space-y-3"
        >
          <label
            htmlFor="home-room-code"
            className="block text-sm font-medium text-slate-700 dark:text-slate-300"
          >
            {t(language, 'joinByCodeLabel')}
          </label>
          <div className="flex gap-2" dir="ltr">
            <div className="relative flex-1">
              <Link2 className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 left-3.5 pointer-events-none" />
              <input
                id="home-room-code"
                type="text"
                dir="ltr"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder={t(language, 'roomCodePlaceholder')}
                className="w-full min-h-[44px] pl-10 pr-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 text-sm font-semibold transition-opacity whitespace-nowrap shrink-0"
            >
              {t(language, 'joinRoomBtn')}
            </button>
          </div>
        </form>
      </section>

      {/* Online Friends & Recent Calls Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Online Friends */}
        <section className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t(language, 'onlineFriendsTitle')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('friends')}
              className="text-sm font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              {t(language, 'viewAllFriends')}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] divide-y divide-slate-100 dark:divide-slate-800/80">
            {onlineFriends.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {t(language, 'noOnlineFriends')}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t(language, 'goToSearch')}
                </button>
              </div>
            ) : (
              onlineFriends.map((friend) => (
                <div
                  key={friend.uid}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <Avatar
                      src={friend.photoURL}
                      name={friend.displayName}
                      presence={friend.presence}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {friend.displayName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        <span dir="ltr" className="inline-block">@{friend.handle}</span> · {presenceLabel(friend.presence)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void startDirectCall(friend, 'voice')}
                      aria-label={`${t(language, 'callVoice')} ${friend.displayName}`}
                      className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void startDirectCall(friend, 'video')}
                      aria-label={`${t(language, 'callVideo')} ${friend.displayName}`}
                      className="min-h-[44px] px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Video className="w-4 h-4" />
                      <span>{t(language, 'callVideo')}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Recent Calls */}
        <section className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {t(language, 'recentCallsTitle')}
            </h2>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className="text-sm font-medium text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap"
            >
              {t(language, 'viewAllHistory')}
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] divide-y divide-slate-100 dark:divide-slate-800/80">
            {recentCalls.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {t(language, 'noRecentCalls')}
              </p>
            ) : (
              recentCalls.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={entry.peerPhoto} name={entry.peerName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {entry.peerName}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                        {entry.status === 'missed' ? (
                          <PhoneMissed className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        ) : entry.direction === 'incoming' ? (
                          <PhoneIncoming className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span>
                          {entry.callType === 'video' ? t(language, 'callVideo') : t(language, 'callVoice')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {formatCallDuration(entry.durationSeconds)}
                        </span>
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums shrink-0">
                    {entry.roomCode}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
