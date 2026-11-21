import { useEffect, useState } from 'react';
import { Check, Search, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import type { PublicProfile } from '../types/app';
import { Avatar } from './Avatar';

export function SearchUsersView() {
  const {
    language,
    publicProfile,
    friends,
    friendRequests,
    searchUsers,
    sendFriendRequest,
  } = useApp();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const list = await searchUsers(query);
        if (active) setResults(list);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, searchUsers]);

  const friendUids = new Set(friends.map((f) => f.uid));
  const sentUids = new Set(
    friendRequests
      .filter((r) => r.status === 'pending' && r.fromUid === publicProfile?.uid)
      .map((r) => r.toUid)
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t(language, 'searchTitle')}
      </h1>

      <div className="relative max-w-xl">
        <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-4 pointer-events-none" />
        <label htmlFor="directory-search-input" className="sr-only">
          {t(language, 'searchPlaceholder')}
        </label>
        <input
          id="directory-search-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(language, 'searchPlaceholder')}
          className="w-full min-h-[48px] ps-11 pe-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((idx) => (
              <div key={idx} className="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            {query.trim() ? t(language, 'noSearchResults') : t(language, 'searchPrompt')}
          </p>
        ) : (
          results.map((person) => {
            const isFriend = friendUids.has(person.uid);
            const isSent = sentUids.has(person.uid);

            return (
              <div
                key={person.uid}
                className="p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <Avatar
                    src={person.photoURL}
                    name={person.displayName}
                    presence={person.presence}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                      {person.displayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      <span dir="ltr" className="inline-block">@{person.handle}</span>
                      {person.bio ? ` · ${person.bio}` : ''}
                    </p>
                  </div>
                </div>

                {isFriend ? (
                  <span className="min-h-[40px] px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 shrink-0">
                    <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    <span>{t(language, 'alreadyFriends')}</span>
                  </span>
                ) : isSent ? (
                  <span className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center shrink-0">
                    {t(language, 'requestSent')}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void sendFriendRequest(person)}
                    className="min-h-[44px] px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{t(language, 'sendFriendRequest')}</span>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
