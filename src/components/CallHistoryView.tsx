import { useState } from 'react';
import { ArrowUpRight, Phone, PhoneIncoming, PhoneMissed, Trash2, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { filterCallHistory, formatCallDuration, type HistoryFilter } from '../utils/callLogic';
import { Avatar } from './Avatar';

export function CallHistoryView() {
  const {
    language,
    callHistory,
    startDirectCall,
    deleteHistoryEntry,
    clearAllHistory,
  } = useApp();

  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [search, setSearch] = useState('');

  const visible = filterCallHistory(callHistory, filter, search);

  const statusText = (s: string) => {
    if (s === 'completed') return t(language, 'statusCompleted');
    if (s === 'missed') return t(language, 'statusMissed');
    if (s === 'rejected') return t(language, 'statusRejected');
    return t(language, 'statusCancelled');
  };

  const formatTimestamp = (ms: number) => {
    try {
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(ms));
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t(language, 'historyTitle')}
        </h1>

        {callHistory.length > 0 && (
          <button
            type="button"
            onClick={() => void clearAllHistory()}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-rose-300 dark:hover:border-rose-800 hover:text-rose-600 text-xs font-medium transition-colors self-start sm:self-auto whitespace-nowrap"
          >
            {t(language, 'clearHistory')}
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-[#131924] border border-slate-200 dark:border-slate-800 self-start overflow-x-auto max-w-full">
          {(['all', 'missed', 'video', 'voice'] as HistoryFilter[]).map((tab) => {
            const label =
              tab === 'all'
                ? t(language, 'filterAll')
                : tab === 'missed'
                  ? t(language, 'filterMissed')
                  : tab === 'video'
                    ? t(language, 'filterVideo')
                    : t(language, 'filterVoice');
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`min-h-[40px] px-4 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  filter === tab
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t(language, 'searchPlaceholder')}
          aria-label={t(language, 'searchPlaceholder')}
          className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] divide-y divide-slate-100 dark:divide-slate-800">
        {visible.length === 0 ? (
          <p className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            {t(language, 'noHistoryMatches')}
          </p>
        ) : (
          visible.map((item) => (
            <div
              key={item.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <Avatar src={item.peerPhoto} name={item.peerName} />
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.peerName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-1.5">
                    {item.status === 'missed' ? (
                      <PhoneMissed className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    ) : item.direction === 'incoming' ? (
                      <PhoneIncoming className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span>
                      {item.direction === 'incoming'
                        ? t(language, 'directionIncoming')
                        : t(language, 'directionOutgoing')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className={item.status === 'missed' ? 'text-rose-500 font-medium' : ''}>
                      {statusText(item.status)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {formatCallDuration(item.durationSeconds)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{formatTimestamp(item.createdAtMs)}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    void startDirectCall(
                      {
                        friendshipId: '',
                        uid: item.peerUid,
                        displayName: item.peerName,
                        handle: 'contact',
                        bio: '',
                        photoURL: item.peerPhoto,
                        presence: 'online',
                      },
                      'voice'
                    )
                  }
                  aria-label={`${t(language, 'callVoice')} ${item.peerName}`}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void startDirectCall(
                      {
                        friendshipId: '',
                        uid: item.peerUid,
                        displayName: item.peerName,
                        handle: 'contact',
                        bio: '',
                        photoURL: item.peerPhoto,
                        presence: 'online',
                      },
                      'video'
                    )
                  }
                  aria-label={`${t(language, 'callVideo')} ${item.peerName}`}
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-teal-700 hover:bg-teal-800 text-white flex items-center justify-center transition-colors"
                >
                  <Video className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void deleteHistoryEntry(item.id)}
                  aria-label={`${t(language, 'deleteRecord')} ${item.peerName}`}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-800 hover:text-rose-600 flex items-center justify-center text-slate-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
