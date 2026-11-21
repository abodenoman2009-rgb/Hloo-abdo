import { useState } from 'react';
import { Check, Phone, Trash2, UserPlus, Video, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { filterContacts, sortContactsByPresence } from '../utils/callLogic';
import { Avatar } from './Avatar';

type FriendsSubTab = 'all' | 'online' | 'requests';

export function FriendsView() {
  const {
    language,
    publicProfile,
    friends,
    friendRequests,
    onlineUids,
    busyUids,
    startDirectCall,
    respondFriendRequest,
    cancelFriendRequest,
    removeFriend,
    setActiveTab,
  } = useApp();

  const [subTab, setSubTab] = useState<FriendsSubTab>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const myUid = publicProfile?.uid || '';
  const pendingIncoming = friendRequests.filter(
    (r) => r.status === 'pending' && r.toUid === myUid
  );
  const pendingOutgoing = friendRequests.filter(
    (r) => r.status === 'pending' && r.fromUid === myUid
  );

  const enrichedFriends = sortContactsByPresence(
    friends.map((f) => ({
      ...f,
      presence: busyUids.has(f.uid)
        ? 'in-call'
        : onlineUids.has(f.uid)
          ? 'online'
          : f.presence,
    }))
  );

  const visibleFriends = filterContacts(enrichedFriends, subTab === 'online', searchTerm);

  const presenceLabel = (p: string) => {
    if (p === 'online') return t(language, 'presenceOnline');
    if (p === 'in-call') return t(language, 'presenceInCall');
    if (p === 'busy') return t(language, 'presenceBusy');
    return t(language, 'presenceOffline');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t(language, 'friendsTitle')}
        </h1>

        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className="min-h-[44px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold flex items-center gap-2 self-start sm:self-auto transition-colors whitespace-nowrap"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t(language, 'goToSearch')}</span>
        </button>
      </div>

      {/* Filter Tabs + Local Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#131924] border border-slate-200 dark:border-slate-800 self-start">
          <button
            type="button"
            onClick={() => setSubTab('all')}
            className={`min-h-[40px] px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === 'all'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(language, 'friendsTabAll')} ({friends.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('online')}
            className={`min-h-[40px] px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === 'online'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(language, 'friendsTabOnline')}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('requests')}
            className={`min-h-[40px] px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              subTab === 'requests'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {t(language, 'friendsTabRequests')} ({pendingIncoming.length + pendingOutgoing.length})
          </button>
        </div>

        {subTab !== 'requests' && (
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t(language, 'searchPlaceholder')}
            aria-label={t(language, 'searchPlaceholder')}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        )}
      </div>

      {subTab === 'requests' ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              {t(language, 'pendingIncoming')}
            </h2>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] divide-y divide-slate-100 dark:divide-slate-800">
              {pendingIncoming.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 dark:text-slate-400">
                  {t(language, 'noRequests')}
                </p>
              ) : (
                pendingIncoming.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar src={req.fromPhoto} name={req.fromName} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{req.fromName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          <span dir="ltr" className="inline-block">@{req.fromHandle}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void respondFriendRequest(req, 'accepted')}
                        className="min-h-[44px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <Check className="w-4 h-4" />
                        <span>{t(language, 'acceptRequest')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondFriendRequest(req, 'rejected')}
                        aria-label={`${t(language, 'rejectRequest')} ${req.fromName}`}
                        className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {pendingOutgoing.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                {t(language, 'pendingOutgoing')}
              </h2>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] divide-y divide-slate-100 dark:divide-slate-800">
                {pendingOutgoing.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar src={req.toPhoto} name={req.toName} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{req.toName}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          <span dir="ltr" className="inline-block">@{req.toHandle}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void cancelFriendRequest(req.id)}
                      className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors whitespace-nowrap shrink-0"
                    >
                      {t(language, 'cancelRequest')}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] divide-y divide-slate-100 dark:divide-slate-800">
          {visibleFriends.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                {t(language, 'noFriendsYet')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {t(language, 'noFriendsHint')}
              </p>
            </div>
          ) : (
            visibleFriends.map((friend) => (
              <div
                key={friend.uid}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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

                <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => void startDirectCall(friend, 'voice')}
                    aria-label={`${t(language, 'callVoice')} ${friend.displayName}`}
                    className="min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Phone className="w-4 h-4" />
                    <span>{t(language, 'callVoice')}</span>
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
                  <button
                    type="button"
                    onClick={() => void removeFriend(friend.friendshipId)}
                    aria-label={`${t(language, 'removeFriend')} ${friend.displayName}`}
                    className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 hover:text-rose-600 flex items-center justify-center text-slate-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
