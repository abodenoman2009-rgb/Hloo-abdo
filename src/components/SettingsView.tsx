import { useState } from 'react';
import { LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';

interface DiagnosticsResult {
  signalingReady: boolean;
  stunConfigured: boolean;
  turnConfigured: boolean;
  iceServerCount: number;
  checkedAt: string;
}

export function SettingsView() {
  const {
    language,
    theme,
    setLanguage,
    setTheme,
    ringtoneEnabled,
    setRingtoneEnabled,
    mediaDevices,
    selectedCameraId,
    selectedMicId,
    setSelectedCameraId,
    setSelectedMicId,
    refreshMediaDevices,
    handleSignOut,
  } = useApp();

  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagnosticsResult | null>(null);

  const runDiagnostics = async () => {
    setDiagLoading(true);
    try {
      const res = await fetch('/api/diagnostics/turn');
      if (res.ok) {
        setDiagResult((await res.json()) as DiagnosticsResult);
      }
      await refreshMediaDevices();
    } finally {
      setDiagLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {t(language, 'settingsTitle')}
      </h1>

      {/* Appearance & Language */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {t(language, 'appearanceSection')}
        </h2>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {t(language, 'themeLabel')}
          </span>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 self-start">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                theme === 'light'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>{t(language, 'themeLight')}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                theme === 'dark'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>{t(language, 'themeDark')}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {t(language, 'languageLabel')}
          </span>
          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800 self-start">
            <button
              type="button"
              onClick={() => setLanguage('ar')}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-medium transition-colors ${
                language === 'ar'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              العربية (RTL)
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`min-h-[40px] px-4 rounded-lg text-xs font-medium transition-colors ${
                language === 'en'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              English (LTR)
            </button>
          </div>
        </div>
      </section>

      {/* Audio & Video Hardware Devices */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 space-y-5">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {t(language, 'devicesSection')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="camera-select"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              {t(language, 'cameraSelectLabel')}
            </label>
            <select
              id="camera-select"
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm"
            >
              <option value="">Default Camera</option>
              {mediaDevices.cameras.map((cam, idx) => (
                <option key={cam.deviceId || idx} value={cam.deviceId}>
                  {cam.label || `Camera ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="mic-select"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
              {t(language, 'micSelectLabel')}
            </label>
            <select
              id="mic-select"
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0B0F17] text-sm"
            >
              <option value="">Default Microphone</option>
              {mediaDevices.microphones.map((mic, idx) => (
                <option key={mic.deviceId || idx} value={mic.deviceId}>
                  {mic.label || `Microphone ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 cursor-pointer">
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {t(language, 'ringtoneToggle')}
          </span>
          <input
            type="checkbox"
            checked={ringtoneEnabled}
            onChange={(e) => setRingtoneEnabled(e.target.checked)}
            className="w-5 h-5 accent-teal-700 rounded"
          />
        </label>
      </section>

      {/* Network & STUN/TURN Diagnostics */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>{t(language, 'networkDiagnosticsSection')}</span>
          </h2>
          <button
            type="button"
            onClick={() => void runDiagnostics()}
            disabled={diagLoading}
            className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-auto"
          >
            {diagLoading ? t(language, 'diagnosticsRunning') : t(language, 'runDiagnostics')}
          </button>
        </div>

        {diagResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">Signaling</p>
              <p className="font-semibold mt-1 text-emerald-600 dark:text-emerald-400">
                {diagResult.signalingReady ? 'Active' : 'Offline'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">STUN</p>
              <p className="font-semibold mt-1">
                {diagResult.stunConfigured ? 'Configured' : 'Missing'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">TURN Relay</p>
              <p className="font-semibold mt-1">
                {diagResult.turnConfigured ? 'Configured' : 'STUN-only (set TURN env)'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-800">
              <p className="text-slate-500">ICE Servers</p>
              <p className="font-mono font-semibold mt-1 tabular-nums">
                {diagResult.iceServerCount}
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="pt-2">
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="min-h-[48px] px-6 rounded-xl border border-rose-300 dark:border-rose-900/70 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-sm flex items-center gap-2 transition-colors whitespace-nowrap"
        >
          <LogOut className="w-4 h-4" />
          <span>{t(language, 'signOut')}</span>
        </button>
      </div>
    </div>
  );
}
