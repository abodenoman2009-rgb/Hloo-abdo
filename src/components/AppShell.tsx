import { useState } from 'react';
import {
  Bell,
  Clock,
  Home,
  Search,
  Settings,
  User,
  Users,
  Video,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { t } from '../i18n/translations';
import type { NavTab } from '../types/app';
import { ActiveCallView } from './ActiveCallView';
import { Avatar } from './Avatar';
import { LoginScreen } from './LoginScreen';
import { CallHistoryView } from './CallHistoryView';
import { FriendsView } from './FriendsView';
import { HomeView } from './HomeView';
import { IncomingCallModal } from './IncomingCallModal';
import { ProfileView } from './ProfileView';
import { SearchUsersView } from './SearchUsersView';
import { SettingsView } from './SettingsView';

export function AppShell() {
  const {
    authReady,
    profileReady,
    authError,
    firebaseUser,
    isPreviewMode,
    publicProfile,
    language,
    activeTab,
    setActiveTab,
    notifications,
    markAllNotificationsRead,
    toastMessage,
  } = useApp();

  const [notifOpen, setNotifOpen] = useState(false);

  if (!authReady || (firebaseUser && !isPreviewMode && !profileReady && !authError)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FA] dark:bg-[#0B0F17]">
        <div className="w-8 h-8 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  if ((!firebaseUser || (!isPreviewMode && !profileReady)) && !isPreviewMode) {
    return <LoginScreen />;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  const navItems: Array<{ id: NavTab; label: string; icon: typeof Home }> = [
    { id: 'home', label: t(language, 'navHome'), icon: Home },
    { id: 'friends', label: t(language, 'navFriends'), icon: Users },
    { id: 'search', label: t(language, 'navSearch'), icon: Search },
    { id: 'history', label: t(language, 'navHistory'), icon: Clock },
    { id: 'profile', label: t(language, 'navProfile'), icon: User },
    { id: 'settings', label: t(language, 'navSettings'), icon: Settings },
  ];

  const mobileTabs = navItems.slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F7F8FA] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (260px) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 border-e border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] p-5 justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-2">
            <span className="w-9 h-9 rounded-xl bg-teal-700 dark:bg-teal-600 text-white flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </span>
            <span className="text-lg font-bold tracking-tight whitespace-nowrap">
              {t(language, 'brand')}
            </span>
          </div>

          <nav aria-label="Main navigation" className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-teal-700/10 dark:bg-teal-500/15 text-teal-700 dark:text-teal-300'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors text-start"
        >
          <Avatar
            src={publicProfile?.photoURL}
            name={publicProfile?.displayName || 'User'}
            size="sm"
            presence="online"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">
              {publicProfile?.displayName || 'User'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              <span dir="ltr" className="inline-block">@{publicProfile?.handle || 'user'}</span>
            </p>
          </div>
        </button>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-30 h-14 px-5 sm:px-8 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#131924]/90 backdrop-blur-md flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 lg:hidden">
            <span className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center">
              <Video className="w-4 h-4" />
            </span>
            <span className="text-base font-bold">{t(language, 'brand')}</span>
          </div>

          <div className="hidden lg:block text-sm font-medium text-slate-500 dark:text-slate-400">
            {navItems.find((n) => n.id === activeTab)?.label}
          </div>

          <div className="flex items-center gap-2 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label={t(language, 'notificationsTitle')}
              aria-expanded={notifOpen}
              className="relative min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-2 end-2 w-2 h-2 rounded-full bg-teal-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              aria-label={t(language, 'navSettings')}
              className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            {notifOpen && (
              <div className="absolute top-12 end-0 w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131924] shadow-xl p-4 space-y-3 z-40">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold">{t(language, 'notificationsTitle')}</h2>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={() => void markAllNotificationsRead()}
                      className="text-xs text-teal-700 dark:text-teal-400 hover:underline"
                    >
                      {t(language, 'markAllRead')}
                    </button>
                  )}
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="py-4 text-xs text-slate-500 text-center">
                      {t(language, 'noNotifications')}
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="py-2.5 space-y-0.5">
                        <p className={`text-xs font-semibold ${n.read ? 'text-slate-500' : ''}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-6 sm:py-8 space-y-6">
          {isPreviewMode && (
            <div className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/70 dark:bg-teal-950/30 px-4 py-2.5 text-xs text-teal-800 dark:text-teal-200">
              {t(language, 'previewModeNote')}
            </div>
          )}

          {activeTab === 'home' && <HomeView />}
          {activeTab === 'friends' && <FriendsView />}
          {activeTab === 'search' && <SearchUsersView />}
          {activeTab === 'history' && <CallHistoryView />}
          {activeTab === 'profile' && <ProfileView />}
          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (56px-64px, <= 15% of 844px viewport) */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#131924]/95 backdrop-blur-md grid grid-cols-5 items-center px-1"
      >
        {mobileTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                isActive
                  ? 'text-teal-700 dark:text-teal-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-[64px]">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Overlays */}
      <IncomingCallModal />
      <ActiveCallView />

      {/* Ephemeral Toast */}
      {toastMessage && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-medium shadow-lg whitespace-nowrap"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
