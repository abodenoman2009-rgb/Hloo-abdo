import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  fetchSession,
  getWsTicket,
  signInWithEmail,
  signOutUser,
  signUpWithEmail,
  type AppUser,
} from '../services/auth';
import {
  appendCallHistoryDoc,
  cancelFriendRequestDoc,
  createCallSessionDoc,
  deleteCallHistoryDoc,
  bootstrapUser,
  markNotificationReadDoc,
  removeFriendshipDoc,
  respondFriendRequestDoc,
  saveProfileEdits,
  searchPublicDirectory,
  sendFriendRequestDoc,
  subscribeCallHistory,
  subscribeDevices,
  subscribeFriendRequests,
  subscribeFriendships,
  subscribeNotifications,
  updateCallSessionStatusDoc,
  updateUserPreferences,
} from '../lib/dataService';
import {
  createIncomingCallSession,
  createOutgoingCallSession,
  generateRoomCode,
  reduceCallSession,
} from '../utils/callLogic';
import {
  mapAuthErrorMessage,
  sanitizeRoomCode,
} from '../utils/validation';
import {
  acquireUserMedia,
  createMicVolumeMonitor,
  listAvailableMediaDevices,
  PeerCallController,
  RingtoneSynthesizer,
  type MediaDevicesSnapshot,
} from '../utils/webrtc';
import {
  PREVIEW_DEVICES,
  PREVIEW_DIRECTORY,
  PREVIEW_FRIENDS,
  PREVIEW_HISTORY,
  PREVIEW_NOTIFICATIONS,
  PREVIEW_PUBLIC_PROFILE,
  PREVIEW_REQUESTS,
  PREVIEW_USER,
} from '../data/seedData';
import type {
  ActiveCallSession,
  CallHistoryItem,
  CallType,
  DeviceItem,
  FriendContact,
  FriendRequestItem,
  IceServerEntry,
  Language,
  NavTab,
  NotificationItem,
  PublicProfile,
  SignalingEvent,
  Theme,
  UserPrivate,
} from '../types/app';

interface AppContextValue {
  authReady: boolean;
  profileReady: boolean;
  isPreviewMode: boolean;
  sessionUser: AppUser | null;
  privateUser: UserPrivate | null;
  publicProfile: PublicProfile | null;
  authLoading: boolean;
  authError: string | null;
  language: Language;
  theme: Theme;
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  handleEmailSignIn: (email: string, password: string) => Promise<void>;
  handleEmailSignUp: (email: string, password: string, displayName: string) => Promise<void>;
  handleSignOut: () => Promise<void>;
  friends: FriendContact[];
  friendRequests: FriendRequestItem[];
  callHistory: CallHistoryItem[];
  notifications: NotificationItem[];
  devices: DeviceItem[];
  onlineUids: Set<string>;
  busyUids: Set<string>;
  activeCall: ActiveCallSession | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  micLevel: number;
  ringtoneEnabled: boolean;
  setRingtoneEnabled: (enabled: boolean) => void;
  mediaDevices: MediaDevicesSnapshot;
  selectedCameraId: string;
  selectedMicId: string;
  setSelectedCameraId: (id: string) => void;
  setSelectedMicId: (id: string) => void;
  refreshMediaDevices: () => Promise<void>;
  startDirectCall: (friend: FriendContact, callType: CallType) => Promise<void>;
  createShareableRoom: (callType: CallType) => Promise<string>;
  joinRoomByCode: (code: string, callType?: CallType) => Promise<void>;
  acceptIncomingCall: (asType?: CallType) => Promise<void>;
  declineIncomingCall: () => void;
  endActiveCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  setVolume: (volume: number) => void;
  upgradeToVideo: () => Promise<void>;
  retryMediaAcquisition: () => Promise<void>;
  simulateIncomingPreviewCall: () => void;
  searchUsers: (term: string) => Promise<PublicProfile[]>;
  sendFriendRequest: (target: PublicProfile) => Promise<void>;
  respondFriendRequest: (req: FriendRequestItem, decision: 'accepted' | 'rejected') => Promise<void>;
  cancelFriendRequest: (reqId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  deleteHistoryEntry: (id: string) => Promise<void>;
  clearAllHistory: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  saveProfile: (updates: {
    displayName: string;
    handle: string;
    bio: string;
    photoURL: string;
    isDiscoverable: boolean;
  }) => Promise<void>;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const isAutostartPreview = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.get('autostart') === '1';
  }, []);

  const [authReady, setAuthReady] = useState(isAutostartPreview);
  const [profileReady, setProfileReady] = useState(isAutostartPreview);
  const [isPreviewMode, setIsPreviewMode] = useState(isAutostartPreview);
  const [sessionUser, setSessionUser] = useState<AppUser | null>(null);
  const [privateUser, setPrivateUser] = useState<UserPrivate | null>(
    isAutostartPreview ? PREVIEW_USER : null
  );
  const [publicProfile, setPublicProfile] = useState<PublicProfile | null>(
    isAutostartPreview ? PREVIEW_PUBLIC_PROFILE : null
  );
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [language, setLanguageState] = useState<Language>('ar');
  const [theme, setThemeState] = useState<Theme>('dark');
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const languageRef = useRef<Language>('ar');
  const themeRef = useRef<Theme>('dark');
  const syncInFlightRef = useRef<{ uid: string; promise: Promise<void> } | null>(null);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  const [friends, setFriends] = useState<FriendContact[]>(
    isAutostartPreview ? PREVIEW_FRIENDS : []
  );
  const [friendRequests, setFriendRequests] = useState<FriendRequestItem[]>(
    isAutostartPreview ? PREVIEW_REQUESTS : []
  );
  const [callHistory, setCallHistory] = useState<CallHistoryItem[]>(
    isAutostartPreview ? PREVIEW_HISTORY : []
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    isAutostartPreview ? PREVIEW_NOTIFICATIONS : []
  );
  const [devices, setDevices] = useState<DeviceItem[]>(
    isAutostartPreview ? PREVIEW_DEVICES : []
  );

  const [onlineUids, setOnlineUids] = useState<Set<string>>(
    () => new Set(isAutostartPreview ? ['user_layla', 'user_tariq', 'user_karim'] : [])
  );
  const [busyUids, setBusyUids] = useState<Set<string>>(
    () => new Set(isAutostartPreview ? ['user_nora'] : [])
  );

  const [activeCall, setActiveCall] = useState<ActiveCallSession | null>(null);
  const activeCallRef = useRef<ActiveCallSession | null>(null);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const micStopRef = useRef<(() => void) | null>(null);

  const [ringtoneEnabled, setRingtoneEnabled] = useState(true);
  const ringtoneRef = useRef<RingtoneSynthesizer | null>(null);
  const [mediaDevices, setMediaDevices] = useState<MediaDevicesSnapshot>({
    cameras: [],
    microphones: [],
  });
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicId, setSelectedMicId] = useState('');

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const iceServersRef = useRef<IceServerEntry[]>([
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]);
  const wsRef = useRef<WebSocket | null>(null);
  const peerCtrlRef = useRef<PeerCallController | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200);
  }, []);

  // Sync HTML dir/lang and .dark class
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }, [language]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Load ICE servers on mount
  useEffect(() => {
    fetch('/api/ice-servers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.iceServers && Array.isArray(data.iceServers)) {
          iceServersRef.current = data.iceServers;
        }
      })
      .catch(() => {});
  }, []);

  const refreshMediaDevices = useCallback(async () => {
    const snapshot = await listAvailableMediaDevices();
    setMediaDevices(snapshot);
  }, []);

  useEffect(() => {
    void refreshMediaDevices();
  }, [refreshMediaDevices]);

  const setLanguage = useCallback(
    (lang: Language) => {
      setLanguageState(lang);
      if (sessionUser && !isPreviewMode) {
        void updateUserPreferences(sessionUser.uid, { preferredLanguage: lang }).catch(() => {});
      }
    },
    [sessionUser, isPreviewMode]
  );

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      setThemeState(nextTheme);
      if (sessionUser && !isPreviewMode) {
        void updateUserPreferences(sessionUser.uid, { preferredTheme: nextTheme }).catch(() => {});
      }
    },
    [sessionUser, isPreviewMode]
  );

  const stopMediaAndPeer = useCallback(() => {
    ringtoneRef.current?.stop();
    micStopRef.current?.();
    micStopRef.current = null;
    setMicLevel(0);
    peerCtrlRef.current?.close();
    peerCtrlRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  const sendSignal = useCallback((payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    }
  }, []);

  const acquireAndBindLocalMedia = useCallback(
    async (callType: CallType, facingMode: 'user' | 'environment' = 'user') => {
      const { stream, error } = await acquireUserMedia({
        callType,
        facingMode,
        cameraDeviceId: selectedCameraId || undefined,
        micDeviceId: selectedMicId || undefined,
      });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      localStreamRef.current = stream;
      setLocalStream(stream);
      micStopRef.current?.();
      if (stream) {
        micStopRef.current = createMicVolumeMonitor(stream, setMicLevel);
      }
      setActiveCall((prev) => reduceCallSession(prev, { type: 'MEDIA_ERROR', message: error }));
      void refreshMediaDevices();
      return stream;
    },
    [refreshMediaDevices, selectedCameraId, selectedMicId]
  );

  const setupPeerConnection = useCallback(
    (callId: string, toUid: string, stream: MediaStream | null) => {
      const ctrl = new PeerCallController(iceServersRef.current, {
        onRemoteStream: (rStream) => {
          setRemoteStream(rStream);
        },
        onIceCandidate: (candidate) => {
          sendSignal({ type: 'webrtc:ice-candidate', callId, toUid, candidate });
        },
        onStateChange: (state) => {
          if (state === 'connected') {
            ringtoneRef.current?.stop();
            setActiveCall((prev) => reduceCallSession(prev, { type: 'CONNECTED', nowMs: Date.now() }));
          } else if (state === 'disconnected' || state === 'failed') {
            setActiveCall((prev) => reduceCallSession(prev, { type: 'RECONNECTING' }));
          }
        },
        onQualitySample: (quality) => {
          setActiveCall((prev) => reduceCallSession(prev, { type: 'SET_QUALITY', quality }));
        },
      });
      ctrl.init(stream);
      peerCtrlRef.current = ctrl;
      return ctrl;
    },
    [sendSignal]
  );

  const ensureUserProfileSynced = useCallback(async (user: AppUser): Promise<void> => {
    if (syncInFlightRef.current && syncInFlightRef.current.uid === user.uid) {
      return syncInFlightRef.current.promise;
    }

    const promise = (async () => {
      const { privateUser: priv, publicProfile: pub } = await bootstrapUser(user);
      setPrivateUser(priv);
      setPublicProfile(pub);
      if (priv.preferredLanguage) setLanguageState(priv.preferredLanguage);
      if (priv.preferredTheme) setThemeState(priv.preferredTheme);
      setProfileReady(true);
    })();

    syncInFlightRef.current = { uid: user.uid, promise };
    try {
      await promise;
    } finally {
      if (syncInFlightRef.current?.promise === promise) {
        syncInFlightRef.current = null;
      }
    }
  }, []);

  // Restore the session (httpOnly cookie) on load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await fetchSession();
        if (cancelled) return;
        if (user) {
          setSessionUser(user);
          setIsPreviewMode(false);
          setAuthError(null);
          try {
            await ensureUserProfileSynced(user);
          } catch (err) {
            console.error('Failed syncing user profile:', err);
            setProfileReady(false);
            setAuthError(mapAuthErrorMessage(err, languageRef.current));
          }
        } else if (!isAutostartPreview) {
          setSessionUser(null);
          setPrivateUser(null);
          setPublicProfile(null);
          setProfileReady(false);
        }
      } catch (err) {
        if (!cancelled) setAuthError(mapAuthErrorMessage(err, languageRef.current));
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureUserProfileSynced, isAutostartPreview]);

  // Live data for authenticated users (polled from the API)
  useEffect(() => {
    if (!sessionUser || !profileReady || isPreviewMode) return;
    const uid = sessionUser.uid;
    const unsubs = [
      subscribeFriendships(uid, setFriends),
      subscribeFriendRequests(uid, setFriendRequests),
      subscribeCallHistory(uid, setCallHistory),
      subscribeNotifications(uid, setNotifications),
      subscribeDevices(uid, setDevices),
    ];
    return () => unsubs.forEach((u) => u());
  }, [sessionUser, isPreviewMode, profileReady]);

  // WebSocket signaling connection for authenticated users
  useEffect(() => {
    if (!sessionUser || !profileReady || isPreviewMode) return;
    let closedByCleanup = false;
    let reconnectTimer: number | null = null;
    let pingTimer: number | null = null;

    const connectWs = async () => {
      try {
        const token = await getWsTicket();
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'auth',
              token,
              displayName: publicProfile?.displayName || sessionUser.displayName || 'User',
              photoURL: publicProfile?.photoURL || sessionUser.photoURL || '',
            })
          );
          pingTimer = window.setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
            }
          }, 25000);
        };

        ws.onmessage = async (event) => {
          let data: SignalingEvent;
          try {
            data = JSON.parse(event.data) as SignalingEvent;
          } catch {
            return;
          }
          switch (data.type) {
            case 'auth:ok':
              setOnlineUids(new Set(data.onlineUids));
              break;
            case 'presence:sync':
              setOnlineUids(new Set(data.onlineUids));
              setBusyUids(new Set(data.busyUids));
              break;
            case 'call:invite': {
              if (activeCallRef.current && activeCallRef.current.phase !== 'ended') {
                sendSignal({
                  type: 'call:reject',
                  callId: data.callId,
                  toUid: data.fromUid,
                  reason: 'busy',
                });
                return;
              }
              const incoming = createIncomingCallSession({
                callId: data.callId,
                roomCode: data.roomCode,
                callType: data.callType,
                fromUid: data.fromUid,
                fromName: data.fromName,
                fromPhoto: data.fromPhoto,
              });
              setActiveCall(incoming);
              if (ringtoneEnabled) {
                ringtoneRef.current = ringtoneRef.current || new RingtoneSynthesizer();
                ringtoneRef.current.start('incoming');
              }
              break;
            }
            case 'call:accept': {
              ringtoneRef.current?.stop();
              const current = activeCallRef.current;
              if (!current || current.callId !== data.callId) return;
              setActiveCall((prev) => reduceCallSession(prev, { type: 'ACCEPT', callType: data.callType }));
              const ctrl = setupPeerConnection(data.callId, data.byUid, localStreamRef.current);
              const offer = await ctrl.createOffer();
              if (offer) {
                sendSignal({ type: 'webrtc:offer', callId: data.callId, toUid: data.byUid, sdp: offer });
              }
              break;
            }
            case 'call:reject': {
              ringtoneRef.current?.stop();
              const current = activeCallRef.current;
              if (current && current.callId === data.callId) {
                stopMediaAndPeer();
                setActiveCall(null);
                showToast(language === 'ar' ? 'تم رفض المكالمة' : 'Call declined');
              }
              break;
            }
            case 'call:end': {
              const current = activeCallRef.current;
              if (current && current.callId === data.callId) {
                stopMediaAndPeer();
                setActiveCall(null);
              }
              break;
            }
            case 'call:media-state':
              setActiveCall((prev) =>
                reduceCallSession(prev, {
                  type: 'PEER_MEDIA',
                  muted: data.muted,
                  cameraOff: data.cameraOff,
                })
              );
              break;
            case 'room:peers': {
              // When joining a room that already has another peer, initiate offer
              const firstPeer = data.peers[0];
              if (firstPeer && activeCallRef.current) {
                setActiveCall((prev) =>
                  prev
                    ? {
                        ...prev,
                        peerUid: firstPeer.uid,
                        peerName: firstPeer.displayName,
                        peerPhoto: firstPeer.photoURL,
                        phase: 'connecting',
                      }
                    : prev
                );
                const ctrl = setupPeerConnection(
                  activeCallRef.current.callId,
                  firstPeer.uid,
                  localStreamRef.current
                );
                const offer = await ctrl.createOffer();
                if (offer) {
                  sendSignal({
                    type: 'webrtc:offer',
                    callId: activeCallRef.current.callId,
                    toUid: firstPeer.uid,
                    sdp: offer,
                  });
                }
              }
              break;
            }
            case 'room:peer-joined': {
              setActiveCall((prev) =>
                prev
                  ? {
                      ...prev,
                      peerUid: data.peer.uid,
                      peerName: data.peer.displayName,
                      peerPhoto: data.peer.photoURL,
                      phase: 'connecting',
                    }
                  : prev
              );
              break;
            }
            case 'room:peer-left': {
              setRemoteStream(null);
              setActiveCall((prev) =>
                prev ? { ...prev, phase: 'outgoing', startedAtMs: null } : prev
              );
              break;
            }
            case 'webrtc:offer': {
              const current = activeCallRef.current;
              if (!current) return;
              const ctrl =
                peerCtrlRef.current ||
                setupPeerConnection(data.callId, data.fromUid, localStreamRef.current);
              const answer = await ctrl.acceptOfferAndCreateAnswer(data.sdp);
              if (answer) {
                sendSignal({ type: 'webrtc:answer', callId: data.callId, toUid: data.fromUid, sdp: answer });
              }
              break;
            }
            case 'webrtc:answer':
              await peerCtrlRef.current?.applyAnswer(data.sdp);
              break;
            case 'webrtc:ice-candidate':
              await peerCtrlRef.current?.addIceCandidate(data.candidate);
              break;
          }
        };

        ws.onclose = () => {
          if (pingTimer !== null) window.clearInterval(pingTimer);
          if (!closedByCleanup) {
            reconnectTimer = window.setTimeout(() => void connectWs(), 2500);
          }
        };
      } catch {
        if (!closedByCleanup) {
          reconnectTimer = window.setTimeout(() => void connectWs(), 3500);
        }
      }
    };

    void connectWs();

    return () => {
      closedByCleanup = true;
      if (pingTimer !== null) window.clearInterval(pingTimer);
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionUser, isPreviewMode, language, profileReady, publicProfile?.displayName, publicProfile?.photoURL, ringtoneEnabled, sendSignal, setupPeerConnection, showToast, stopMediaAndPeer]);

  const finishSignIn = useCallback(
    async (user: AppUser) => {
      setSessionUser(user);
      setIsPreviewMode(false);
      await ensureUserProfileSynced(user);
      setActiveTab('home');
    },
    [ensureUserProfileSynced]
  );

  const handleEmailSignIn = useCallback(
    async (email: string, password: string) => {
      setAuthError(null);
      setAuthLoading(true);
      try {
        await finishSignIn(await signInWithEmail(email, password));
      } finally {
        setAuthLoading(false);
      }
    },
    [finishSignIn]
  );

  const handleEmailSignUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      setAuthError(null);
      setAuthLoading(true);
      try {
        const user = await signUpWithEmail(email, password, displayName, {
          preferredLanguage: languageRef.current,
          preferredTheme: themeRef.current,
        });
        await finishSignIn(user);
      } finally {
        setAuthLoading(false);
      }
    },
    [finishSignIn]
  );

  const handleSignOut = useCallback(async () => {
    stopMediaAndPeer();
    setActiveCall(null);
    if (sessionUser && !isPreviewMode) {
      await signOutUser();
      setProfileReady(false);
      setFriends([]);
      setFriendRequests([]);
      setCallHistory([]);
      setNotifications([]);
      setDevices([]);
      setActiveTab('home');
    } else {
      setIsPreviewMode(false);
      setPrivateUser(null);
      setPublicProfile(null);
      setProfileReady(false);
      setActiveTab('home');
    }
  }, [sessionUser, isPreviewMode, stopMediaAndPeer]);

  const startDirectCall = useCallback(
    async (friend: FriendContact, callType: CallType) => {
      const callId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const roomCode = generateRoomCode();
      const session = createOutgoingCallSession({
        callId,
        roomCode,
        callType,
        peerUid: friend.uid,
        peerName: friend.displayName,
        peerPhoto: friend.photoURL,
      });
      setActiveCall(session);
      if (ringtoneEnabled) {
        ringtoneRef.current = ringtoneRef.current || new RingtoneSynthesizer();
        ringtoneRef.current.start('outgoing');
      }

      await acquireAndBindLocalMedia(callType, 'user');

      if (sessionUser && !isPreviewMode) {
        void createCallSessionDoc({
          callId,
          roomCode,
          hostUid: sessionUser.uid,
          hostName: publicProfile?.displayName || 'Host',
          callType,
          isPublicLink: false,
          invitedUid: friend.uid,
        }).catch(() => {});
        sendSignal({ type: 'call:invite', callId, roomCode, toUid: friend.uid, callType });
      } else {
        // Preview mode transitions smoothly into active local preview after 1.2s
        window.setTimeout(() => {
          ringtoneRef.current?.stop();
          setActiveCall((prev) =>
            prev && prev.callId === callId
              ? reduceCallSession(prev, { type: 'CONNECTED', nowMs: Date.now() })
              : prev
          );
        }, 1200);
      }
    },
    [acquireAndBindLocalMedia, sessionUser, isPreviewMode, publicProfile?.displayName, ringtoneEnabled, sendSignal]
  );

  const createShareableRoom = useCallback(
    async (callType: CallType): Promise<string> => {
      const callId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const roomCode = generateRoomCode();
      const session = createOutgoingCallSession({
        callId,
        roomCode,
        callType,
        peerUid: 'room_lobby',
        peerName: `${language === 'ar' ? 'غرفة' : 'Room'} ${roomCode}`,
        peerPhoto: '',
        isRoomHost: true,
      });
      setActiveCall(session);
      await acquireAndBindLocalMedia(callType, 'user');

      if (sessionUser && !isPreviewMode) {
        void createCallSessionDoc({
          callId,
          roomCode,
          hostUid: sessionUser.uid,
          hostName: publicProfile?.displayName || 'Host',
          callType,
          isPublicLink: true,
        }).catch(() => {});
        sendSignal({ type: 'room:join', roomCode, callType });
      } else {
        setActiveCall((prev) => reduceCallSession(prev, { type: 'CONNECTED', nowMs: Date.now() }));
      }
      return roomCode;
    },
    [acquireAndBindLocalMedia, sessionUser, isPreviewMode, language, publicProfile?.displayName, sendSignal]
  );

  const joinRoomByCode = useCallback(
    async (rawCode: string, callType: CallType = 'video') => {
      const cleanCode = sanitizeRoomCode(rawCode);
      if (cleanCode.length < 4) return;
      const callId = `room_${Date.now()}`;
      const session = createOutgoingCallSession({
        callId,
        roomCode: cleanCode,
        callType,
        peerUid: 'room_lobby',
        peerName: `${language === 'ar' ? 'غرفة' : 'Room'} ${cleanCode}`,
        peerPhoto: '',
        isRoomHost: false,
      });
      setActiveCall(session);
      await acquireAndBindLocalMedia(callType, 'user');

      if (sessionUser && !isPreviewMode) {
        sendSignal({ type: 'room:join', roomCode: cleanCode, callType });
      } else {
        setActiveCall((prev) => reduceCallSession(prev, { type: 'CONNECTED', nowMs: Date.now() }));
      }
    },
    [acquireAndBindLocalMedia, sessionUser, isPreviewMode, language, sendSignal]
  );

  // Check URL ?room=CODE when signed in
  useEffect(() => {
    if (!authReady || (!sessionUser && !isPreviewMode)) return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && !activeCallRef.current) {
      void joinRoomByCode(roomParam, 'video');
    }
  }, [authReady, sessionUser, isPreviewMode, joinRoomByCode]);

  const acceptIncomingCall = useCallback(
    async (asType?: CallType) => {
      ringtoneRef.current?.stop();
      const current = activeCallRef.current;
      if (!current || current.phase !== 'incoming') return;
      const nextType = asType || current.callType;
      setActiveCall((prev) => reduceCallSession(prev, { type: 'ACCEPT', callType: nextType }));
      await acquireAndBindLocalMedia(nextType, 'user');

      if (sessionUser && !isPreviewMode) {
        void updateCallSessionStatusDoc(current.callId, 'active', nextType);
        sendSignal({
          type: 'call:accept',
          callId: current.callId,
          roomCode: current.roomCode,
          toUid: current.peerUid,
          callType: nextType,
        });
      } else {
        setActiveCall((prev) => reduceCallSession(prev, { type: 'CONNECTED', nowMs: Date.now() }));
      }
    },
    [acquireAndBindLocalMedia, sessionUser, isPreviewMode, sendSignal]
  );

  const declineIncomingCall = useCallback(() => {
    ringtoneRef.current?.stop();
    const current = activeCallRef.current;
    if (!current) return;
    if (sessionUser && !isPreviewMode) {
      void updateCallSessionStatusDoc(current.callId, 'ended');
      sendSignal({ type: 'call:reject', callId: current.callId, toUid: current.peerUid, reason: 'declined' });
      void appendCallHistoryDoc(sessionUser.uid, {
        peerUid: current.peerUid,
        peerName: current.peerName,
        peerPhoto: current.peerPhoto,
        callType: current.callType,
        direction: 'incoming',
        status: 'rejected',
        durationSeconds: 0,
        roomCode: current.roomCode,
      }).catch(() => {});
    } else {
      setCallHistory((prev) => [
        {
          id: `hist_${Date.now()}`,
          ownerUid: PREVIEW_USER.uid,
          peerUid: current.peerUid,
          peerName: current.peerName,
          peerPhoto: current.peerPhoto,
          callType: current.callType,
          direction: 'incoming',
          status: 'rejected',
          durationSeconds: 0,
          roomCode: current.roomCode,
          createdAtMs: Date.now(),
        },
        ...prev,
      ]);
    }
    setActiveCall(null);
  }, [sessionUser, isPreviewMode, sendSignal]);

  const endActiveCall = useCallback(() => {
    const current = activeCallRef.current;
    stopMediaAndPeer();
    if (!current) return;

    const durationSeconds = current.startedAtMs
      ? Math.max(0, Math.round((Date.now() - current.startedAtMs) / 1000))
      : 0;
    const finalStatus: CallHistoryItem['status'] =
      current.startedAtMs !== null ? 'completed' : 'cancelled';

    if (sessionUser && !isPreviewMode) {
      void updateCallSessionStatusDoc(current.callId, 'ended');
      sendSignal({
        type: 'call:end',
        callId: current.callId,
        toUid: current.peerUid !== 'room_lobby' ? current.peerUid : undefined,
        roomCode: current.roomCode,
      });
      void appendCallHistoryDoc(sessionUser.uid, {
        peerUid: current.peerUid,
        peerName: current.peerName,
        peerPhoto: current.peerPhoto,
        callType: current.callType,
        direction: current.direction === 'incoming' ? 'incoming' : 'outgoing',
        status: finalStatus,
        durationSeconds,
        roomCode: current.roomCode,
      }).catch(() => {});
    } else {
      setCallHistory((prev) => [
        {
          id: `hist_${Date.now()}`,
          ownerUid: PREVIEW_USER.uid,
          peerUid: current.peerUid,
          peerName: current.peerName,
          peerPhoto: current.peerPhoto,
          callType: current.callType,
          direction: current.direction === 'incoming' ? 'incoming' : 'outgoing',
          status: finalStatus,
          durationSeconds,
          roomCode: current.roomCode,
          createdAtMs: Date.now(),
        },
        ...prev,
      ]);
    }
    setActiveCall(null);
  }, [sessionUser, isPreviewMode, sendSignal, stopMediaAndPeer]);

  const toggleMute = useCallback(() => {
    const nextMuted = !(activeCallRef.current?.localMuted ?? false);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setActiveCall((prev) => reduceCallSession(prev, { type: 'TOGGLE_MUTE' }));
    const current = activeCallRef.current;
    if (current && current.peerUid !== 'room_lobby' && !isPreviewMode) {
      sendSignal({
        type: 'call:media-state',
        callId: current.callId,
        toUid: current.peerUid,
        muted: nextMuted,
        cameraOff: current.localCameraOff,
      });
    }
  }, [isPreviewMode, sendSignal]);

  const toggleCamera = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;
    const nextOff = !current.localCameraOff;
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((t) => {
          t.enabled = !nextOff;
        });
      } else if (!nextOff) {
        const newStream = await acquireAndBindLocalMedia('video', current.facingMode);
        const newVideoTrack = newStream?.getVideoTracks()[0];
        if (newVideoTrack) peerCtrlRef.current?.replaceVideoTrack(newVideoTrack);
      }
    }
    setActiveCall((prev) => reduceCallSession(prev, { type: 'TOGGLE_CAMERA' }));
    if (current.peerUid !== 'room_lobby' && !isPreviewMode) {
      sendSignal({
        type: 'call:media-state',
        callId: current.callId,
        toUid: current.peerUid,
        muted: current.localMuted,
        cameraOff: nextOff,
      });
    }
  }, [acquireAndBindLocalMedia, isPreviewMode, sendSignal]);

  const switchCamera = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;
    const nextFacing = current.facingMode === 'user' ? 'environment' : 'user';
    setActiveCall((prev) => reduceCallSession(prev, { type: 'SWITCH_FACING' }));
    const newStream = await acquireAndBindLocalMedia('video', nextFacing);
    const newVideoTrack = newStream?.getVideoTracks()[0];
    if (newVideoTrack) {
      peerCtrlRef.current?.replaceVideoTrack(newVideoTrack);
    }
  }, [acquireAndBindLocalMedia]);

  const setVolume = useCallback((volume: number) => {
    setActiveCall((prev) => reduceCallSession(prev, { type: 'SET_VOLUME', volume }));
  }, []);

  const upgradeToVideo = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;
    setActiveCall((prev) => reduceCallSession(prev, { type: 'SET_CALL_TYPE', callType: 'video' }));
    const newStream = await acquireAndBindLocalMedia('video', current.facingMode);
    const newVideoTrack = newStream?.getVideoTracks()[0];
    if (newVideoTrack) {
      peerCtrlRef.current?.replaceVideoTrack(newVideoTrack);
    }
  }, [acquireAndBindLocalMedia]);

  const retryMediaAcquisition = useCallback(async () => {
    const current = activeCallRef.current;
    if (!current) return;
    await acquireAndBindLocalMedia(current.callType, current.facingMode);
  }, [acquireAndBindLocalMedia]);

  const simulateIncomingPreviewCall = useCallback(() => {
    const sample = PREVIEW_FRIENDS[0];
    const incoming = createIncomingCallSession({
      callId: `sim_${Date.now()}`,
      roomCode: generateRoomCode(),
      callType: 'video',
      fromUid: sample.uid,
      fromName: sample.displayName,
      fromPhoto: sample.photoURL,
    });
    setActiveCall(incoming);
    if (ringtoneEnabled) {
      ringtoneRef.current = ringtoneRef.current || new RingtoneSynthesizer();
      ringtoneRef.current.start('incoming');
    }
  }, [ringtoneEnabled]);

  const searchUsers = useCallback(
    async (term: string): Promise<PublicProfile[]> => {
      if (isPreviewMode || !sessionUser) {
        const q = term.trim().toLowerCase();
        return PREVIEW_DIRECTORY.filter(
          (u) =>
            !q ||
            u.displayName.toLowerCase().includes(q) ||
            u.handle.toLowerCase().includes(q)
        );
      }
      return searchPublicDirectory(sessionUser.uid, term);
    },
    [sessionUser, isPreviewMode]
  );

  const sendFriendRequest = useCallback(
    async (target: PublicProfile) => {
      if (isPreviewMode || !sessionUser || !publicProfile) {
        setFriendRequests((prev) => [
          {
            id: `req_out_${target.uid}`,
            fromUid: PREVIEW_USER.uid,
            toUid: target.uid,
            fromName: PREVIEW_USER.displayName,
            fromHandle: PREVIEW_PUBLIC_PROFILE.handle,
            fromPhoto: PREVIEW_USER.photoURL,
            toName: target.displayName,
            toHandle: target.handle,
            toPhoto: target.photoURL,
            status: 'pending',
            createdAtMs: Date.now(),
          },
          ...prev.filter((r) => r.toUid !== target.uid),
        ]);
        showToast(language === 'ar' ? 'تم إرسال طلب الصداقة' : 'Friend request sent');
        return;
      }
      await sendFriendRequestDoc(publicProfile, target);
      showToast(language === 'ar' ? 'تم إرسال طلب الصداقة' : 'Friend request sent');
    },
    [sessionUser, isPreviewMode, language, publicProfile, showToast]
  );

  const respondFriendRequest = useCallback(
    async (req: FriendRequestItem, decision: 'accepted' | 'rejected') => {
      if (isPreviewMode || !sessionUser) {
        setFriendRequests((prev) =>
          prev.map((item) => (item.id === req.id ? { ...item, status: decision } : item))
        );
        if (decision === 'accepted') {
          setFriends((prev) => [
            {
              friendshipId: `fr_${req.fromUid}`,
              uid: req.fromUid,
              displayName: req.fromName,
              handle: req.fromHandle,
              bio: '',
              photoURL: req.fromPhoto,
              presence: 'online',
            },
            ...prev,
          ]);
        }
        return;
      }
      await respondFriendRequestDoc(req, decision);
    },
    [sessionUser, isPreviewMode]
  );

  const cancelFriendRequest = useCallback(
    async (reqId: string) => {
      if (isPreviewMode || !sessionUser) {
        setFriendRequests((prev) => prev.filter((r) => r.id !== reqId));
        return;
      }
      await cancelFriendRequestDoc(reqId);
    },
    [sessionUser, isPreviewMode]
  );

  const removeFriend = useCallback(
    async (friendshipId: string) => {
      if (isPreviewMode || !sessionUser) {
        setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
        return;
      }
      await removeFriendshipDoc(friendshipId);
    },
    [sessionUser, isPreviewMode]
  );

  const deleteHistoryEntry = useCallback(
    async (id: string) => {
      if (isPreviewMode || !sessionUser) {
        setCallHistory((prev) => prev.filter((h) => h.id !== id));
        return;
      }
      await deleteCallHistoryDoc(sessionUser.uid, id);
    },
    [sessionUser, isPreviewMode]
  );

  const clearAllHistory = useCallback(async () => {
    if (isPreviewMode || !sessionUser) {
      setCallHistory([]);
      return;
    }
    await Promise.all(callHistory.map((item) => deleteCallHistoryDoc(sessionUser.uid, item.id)));
  }, [callHistory, sessionUser, isPreviewMode]);

  const markAllNotificationsRead = useCallback(async () => {
    if (isPreviewMode || !sessionUser) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      return;
    }
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(unread.map((n) => markNotificationReadDoc(sessionUser.uid, n.id)));
  }, [sessionUser, isPreviewMode, notifications]);

  const saveProfile = useCallback(
    async (updates: {
      displayName: string;
      handle: string;
      bio: string;
      photoURL: string;
      isDiscoverable: boolean;
    }) => {
      if (isPreviewMode || !sessionUser) {
        setPrivateUser((prev) =>
          prev ? { ...prev, displayName: updates.displayName, photoURL: updates.photoURL } : prev
        );
        setPublicProfile((prev) =>
          prev
            ? {
                ...prev,
                displayName: updates.displayName,
                handle: updates.handle,
                bio: updates.bio,
                photoURL: updates.photoURL,
                isDiscoverable: updates.isDiscoverable,
              }
            : prev
        );
        return;
      }
      await saveProfileEdits(sessionUser.uid, updates);
      setPrivateUser((prev) =>
        prev ? { ...prev, displayName: updates.displayName, photoURL: updates.photoURL } : prev
      );
      setPublicProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: updates.displayName,
              handle: updates.handle,
              bio: updates.bio,
              photoURL: updates.photoURL,
              isDiscoverable: updates.isDiscoverable,
            }
          : prev
      );
    },
    [sessionUser, isPreviewMode]
  );

  const value: AppContextValue = {
    authReady,
    profileReady,
    isPreviewMode,
    sessionUser,
    privateUser,
    publicProfile,
    authLoading,
    authError,
    language,
    theme,
    activeTab,
    setActiveTab,
    setLanguage,
    setTheme,
    handleEmailSignIn,
    handleEmailSignUp,
    handleSignOut,
    friends,
    friendRequests,
    callHistory,
    notifications,
    devices,
    onlineUids,
    busyUids,
    activeCall,
    localStream,
    remoteStream,
    micLevel,
    ringtoneEnabled,
    setRingtoneEnabled,
    mediaDevices,
    selectedCameraId,
    selectedMicId,
    setSelectedCameraId,
    setSelectedMicId,
    refreshMediaDevices,
    startDirectCall,
    createShareableRoom,
    joinRoomByCode,
    acceptIncomingCall,
    declineIncomingCall,
    endActiveCall,
    toggleMute,
    toggleCamera,
    switchCamera,
    setVolume,
    upgradeToVideo,
    retryMediaAcquisition,
    simulateIncomingPreviewCall,
    searchUsers,
    sendFriendRequest,
    respondFriendRequest,
    cancelFriendRequest,
    removeFriend,
    deleteHistoryEntry,
    clearAllHistory,
    markAllNotificationsRead,
    saveProfile,
    toastMessage,
    showToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
