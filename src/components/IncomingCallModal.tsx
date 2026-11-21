import { Phone, PhoneOff, Video } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { Avatar } from './Avatar';

export function IncomingCallModal() {
  const { language, activeCall, acceptIncomingCall, declineIncomingCall } = useApp();

  if (!activeCall || activeCall.phase !== 'incoming') return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      className="fixed inset-0 z-50 bg-[#0B0F17]/95 backdrop-blur-xl text-white flex flex-col items-center justify-between px-6 py-12"
    >
      <div className="text-center space-y-2 mt-4">
        <p className="text-sm font-medium text-teal-400">
          {activeCall.callType === 'video'
            ? t(language, 'incomingVideoCall')
            : t(language, 'incomingVoiceCall')}
        </p>
        <p className="text-xs font-mono text-slate-400 tabular-nums">
          {activeCall.roomCode}
        </p>
      </div>

      <div className="flex flex-col items-center gap-6 text-center">
        <div className="relative p-1.5 rounded-full ring-2 ring-teal-500/40 flex items-center justify-center">
          <Avatar src={activeCall.peerPhoto} name={activeCall.peerName} size="xl" />
        </div>
        <h2 id="incoming-call-title" className="text-3xl font-bold tracking-tight">
          {activeCall.peerName}
        </h2>
      </div>

      <div className="flex items-center justify-center gap-6 sm:gap-10 mb-6">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={declineIncomingCall}
            aria-label={t(language, 'declineCall')}
            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition-transform active:scale-95"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
          <span className="text-xs text-slate-300">{t(language, 'declineCall')}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void acceptIncomingCall('voice')}
            aria-label={t(language, 'acceptAudio')}
            className="w-16 h-16 rounded-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 flex items-center justify-center transition-transform active:scale-95"
          >
            <Phone className="w-6 h-6" />
          </button>
          <span className="text-xs text-slate-300">{t(language, 'acceptAudio')}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void acceptIncomingCall('video')}
            aria-label={t(language, 'acceptVideo')}
            className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition-transform active:scale-95"
          >
            <Video className="w-7 h-7" />
          </button>
          <span className="text-xs text-slate-300">{t(language, 'acceptVideo')}</span>
        </div>
      </div>
    </div>
  );
}
