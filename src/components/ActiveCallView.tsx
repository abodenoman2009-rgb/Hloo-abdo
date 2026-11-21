import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Copy,
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  SwitchCamera,
  Video,
  Volume2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import { formatCallDuration } from '../utils/callLogic';
import { Avatar } from './Avatar';

export function ActiveCallView() {
  const {
    language,
    activeCall,
    localStream,
    remoteStream,
    micLevel,
    endActiveCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    setVolume,
    upgradeToVideo,
    retryMediaAcquisition,
    showToast,
  } = useApp();

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!activeCall || !activeCall.startedAtMs) {
      setElapsedSeconds(0);
      return;
    }
    const update = () => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - activeCall.startedAtMs!) / 1000)));
    };
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [activeCall?.startedAtMs, activeCall?.callId]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, activeCall?.callType, activeCall?.localCameraOff]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.volume = activeCall?.volume ?? 1;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.volume = activeCall?.volume ?? 1;
    }
  }, [remoteStream, activeCall?.volume]);

  if (!activeCall || activeCall.phase === 'incoming' || activeCall.phase === 'ended') {
    return null;
  }

  const isVideoMode = activeCall.callType === 'video';
  const hasRemoteVideo = Boolean(remoteStream && remoteStream.getVideoTracks().length > 0 && !activeCall.peerCameraOff);

  const statusText =
    activeCall.phase === 'outgoing'
      ? activeCall.isRoomHost
        ? t(language, 'waitingForPeer')
        : t(language, 'callingStatus')
      : activeCall.phase === 'connecting'
        ? t(language, 'connectingStatus')
        : activeCall.phase === 'reconnecting'
          ? t(language, 'reconnectingStatus')
          : formatCallDuration(elapsedSeconds);

  const qualityText =
    activeCall.connectionQuality === 'excellent'
      ? t(language, 'qualityExcellent')
      : activeCall.connectionQuality === 'good'
        ? t(language, 'qualityGood')
        : activeCall.connectionQuality === 'fair'
          ? t(language, 'qualityFair')
          : t(language, 'qualityPoor');

  const handleCopyInvite = async () => {
    const url = `${window.location.origin}/?room=${activeCall.roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard may fail in headless browser
    }
    showToast(`${t(language, 'linkCopied')} (${activeCall.roomCode})`);
  };

  return (
    <div
      data-testid="active-call-screen"
      data-call-type={activeCall.callType}
      className="fixed inset-0 z-50 bg-[#0B0F17] text-white flex flex-col justify-between overflow-hidden"
    >
      {/* Hidden audio element ensures voice playback even in audio-only calls */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Top Bar */}
      <header className="relative z-20 flex items-center justify-between gap-4 px-5 py-4 bg-gradient-to-b from-black/75 to-transparent">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold truncate">
            {activeCall.peerName}
          </h1>
          <div className="flex items-center gap-2 text-xs text-slate-300 font-mono tabular-nums">
            <span>{statusText}</span>
            <span aria-hidden="true">·</span>
            <span>{activeCall.roomCode}</span>
            <span aria-hidden="true">·</span>
            <span className="font-sans">{qualityText}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleCopyInvite()}
          className="min-h-[44px] px-4 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
        >
          <Copy className="w-4 h-4" />
          <span>{t(language, 'shareRoomLink')}</span>
        </button>
      </header>

      {/* Permission Error Recovery Banner */}
      {activeCall.mediaError && (
        <div
          role="alert"
          className="relative z-20 mx-auto max-w-lg px-4 py-3 rounded-2xl bg-amber-950/90 border border-amber-700/60 text-amber-100 text-xs flex flex-col sm:flex-row items-start sm:items-center gap-3"
        >
          <div className="space-y-0.5">
            <p className="font-semibold">{t(language, 'permissionErrorTitle')}</p>
            <p className="text-amber-200/80">{t(language, 'permissionErrorHelp')}</p>
          </div>
          <button
            type="button"
            onClick={() => void retryMediaAcquisition()}
            className="min-h-[40px] px-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t(language, 'retryMedia')}</span>
          </button>
        </div>
      )}

      {/* Main Stage: Screen 6 (Video Call) vs Screen 7 (Voice Call) */}
      {isVideoMode ? (
        <div className="relative flex-1 flex items-center justify-center">
          {hasRemoteVideo ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-5 px-6 text-center">
              <Avatar src={activeCall.peerPhoto} name={activeCall.peerName} size="xl" />
              <div className="space-y-1">
                <p className="text-xl font-semibold">{activeCall.peerName}</p>
                <p className="text-sm text-slate-400">
                  {activeCall.peerCameraOff && activeCall.phase === 'active'
                    ? t(language, 'peerCameraOff')
                    : statusText}
                </p>
              </div>
              {activeCall.peerMuted && (
                <p className="text-xs text-rose-300 flex items-center gap-1.5">
                  <MicOff className="w-3.5 h-3.5" />
                  <span>{t(language, 'peerMutedBadge')}</span>
                </p>
              )}
            </div>
          )}

          {/* Local PiP Camera Preview */}
          <div className="absolute bottom-4 end-4 z-20 w-32 sm:w-44 aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden border border-white/20 bg-slate-900 shadow-2xl flex items-center justify-center">
            {localStream && !activeCall.localCameraOff && localStream.getVideoTracks().length > 0 ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${activeCall.facingMode === 'user' ? '-scale-x-100' : ''}`}
              />
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-slate-400 text-xs">
                <CameraOff className="w-5 h-5" />
                <span>{t(language, 'peerCameraOff')}</span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Screen 7: Acoustic Voice Call Portrait Stage */
        <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center gap-8">
          <div className="relative flex items-center justify-center">
            <div
              className="w-40 h-40 rounded-full border border-teal-500/30 flex items-center justify-center transition-transform duration-150"
              style={{ transform: `scale(${1 + micLevel * 0.12})` }}
            >
              <Avatar src={activeCall.peerPhoto} name={activeCall.peerName} size="xl" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">{activeCall.peerName}</h2>
            <p className="text-sm font-mono tabular-nums text-teal-400">{statusText}</p>
          </div>

          {/* Live Acoustic Waveform Bars */}
          <div aria-hidden="true" className="flex items-end justify-center gap-1.5 h-10">
            {[0.35, 0.7, 1, 0.8, 0.45, 0.9, 0.5].map((weight, idx) => (
              <span
                key={idx}
                className="w-1.5 rounded-full bg-teal-400/80 transition-all duration-100"
                style={{
                  height: `${Math.max(8, Math.round((activeCall.localMuted ? 0.12 : 0.25 + micLevel * weight) * 40))}px`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Bottom Call Control Dock */}
      <footer className="relative z-20 px-4 py-5 bg-gradient-to-t from-black/85 via-black/60 to-transparent">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={toggleMute}
            aria-label={activeCall.localMuted ? t(language, 'unmuteMic') : t(language, 'muteMic')}
            className={`min-h-[48px] min-w-[48px] px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
              activeCall.localMuted
                ? 'bg-white text-slate-900'
                : 'bg-white/15 hover:bg-white/25 text-white'
            }`}
          >
            {activeCall.localMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span className="hidden sm:inline">
              {activeCall.localMuted ? t(language, 'unmuteMic') : t(language, 'muteMic')}
            </span>
          </button>

          {isVideoMode ? (
            <>
              <button
                type="button"
                onClick={() => void toggleCamera()}
                aria-label={
                  activeCall.localCameraOff
                    ? t(language, 'turnOnCamera')
                    : t(language, 'turnOffCamera')
                }
                className={`min-h-[48px] min-w-[48px] px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
                  activeCall.localCameraOff
                    ? 'bg-white text-slate-900'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                }`}
              >
                {activeCall.localCameraOff ? (
                  <CameraOff className="w-5 h-5" />
                ) : (
                  <Camera className="w-5 h-5" />
                )}
                <span className="hidden sm:inline">
                  {activeCall.localCameraOff
                    ? t(language, 'turnOnCamera')
                    : t(language, 'turnOffCamera')}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void switchCamera()}
                aria-label={t(language, 'switchCamera')}
                className="min-h-[48px] min-w-[48px] px-3.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => void upgradeToVideo()}
              aria-label={t(language, 'upgradeToVideo')}
              className="min-h-[48px] px-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center gap-2 text-xs font-medium transition-colors"
            >
              <Video className="w-5 h-5" />
              <span className="hidden sm:inline">{t(language, 'upgradeToVideo')}</span>
            </button>
          )}

          {/* Speaker Volume Control */}
          <div className="min-h-[48px] px-3.5 rounded-2xl bg-white/10 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-slate-300 shrink-0" />
            <label htmlFor="call-volume-slider" className="sr-only">
              {t(language, 'speakerVolume')}
            </label>
            <input
              id="call-volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={activeCall.volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-20 accent-teal-500 cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={endActiveCall}
            aria-label={t(language, 'endCall')}
            className="min-h-[48px] px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <PhoneOff className="w-5 h-5" />
            <span>{t(language, 'endCall')}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
