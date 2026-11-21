import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIceConfiguration,
  createIncomingCallSession,
  createOutgoingCallSession,
  filterCallHistory,
  filterContacts,
  formatCallDuration,
  generateRoomCode,
  reduceCallSession,
  sortContactsByPresence,
} from './callLogic';
import type { CallHistoryItem, FriendContact } from '../types/app';

test('generateRoomCode returns XXX-XXXX uppercase code from safe alphabet', () => {
  let i = 0;
  const code = generateRoomCode(() => {
    i += 1;
    return (i * 0.13) % 1;
  });
  assert.match(code, /^[A-Z2-9]{3}-[A-Z2-9]{4}$/);
});

test('formatCallDuration formats MM:SS and HH:MM:SS cleanly', () => {
  assert.equal(formatCallDuration(0), '00:00');
  assert.equal(formatCallDuration(65), '01:05');
  assert.equal(formatCallDuration(3661), '01:01:01');
  assert.equal(formatCallDuration(-10), '00:00');
});

test('buildIceConfiguration uses defaults when empty and custom servers when supplied', () => {
  const defaultCfg = buildIceConfiguration();
  assert.equal(defaultCfg.iceServers?.length, 2);

  const customCfg = buildIceConfiguration([
    { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' },
  ]);
  assert.equal(customCfg.iceServers?.length, 1);
  assert.equal(customCfg.iceServers?.[0].username, 'u');
});

test('call state reducer handles full outgoing and incoming lifecycle', () => {
  const outgoing = createOutgoingCallSession({
    callId: 'c1',
    roomCode: 'WRK-8241',
    callType: 'video',
    peerUid: 'u2',
    peerName: 'Layla',
    peerPhoto: '',
  });
  assert.equal(outgoing.phase, 'outgoing');
  assert.equal(outgoing.localCameraOff, false);

  const connected = reduceCallSession(outgoing, { type: 'CONNECTED', nowMs: 1000 });
  assert.equal(connected?.phase, 'active');
  assert.equal(connected?.startedAtMs, 1000);

  const muted = reduceCallSession(connected, { type: 'TOGGLE_MUTE' });
  assert.equal(muted?.localMuted, true);

  const switched = reduceCallSession(muted, { type: 'SWITCH_FACING' });
  assert.equal(switched?.facingMode, 'environment');

  const reconnecting = reduceCallSession(switched, { type: 'RECONNECTING' });
  assert.equal(reconnecting?.phase, 'reconnecting');

  const recovered = reduceCallSession(reconnecting, { type: 'RECOVERED' });
  assert.equal(recovered?.phase, 'active');

  const ended = reduceCallSession(recovered, { type: 'END' });
  assert.equal(ended?.phase, 'ended');

  const incoming = createIncomingCallSession({
    callId: 'c2',
    roomCode: 'ABC-9912',
    callType: 'voice',
    fromUid: 'u3',
    fromName: 'Tariq',
    fromPhoto: '',
  });
  const acceptedAsVideo = reduceCallSession(incoming, { type: 'ACCEPT', callType: 'video' });
  assert.equal(acceptedAsVideo?.phase, 'connecting');
  assert.equal(acceptedAsVideo?.callType, 'video');
  assert.equal(acceptedAsVideo?.localCameraOff, false);
});

test('filterCallHistory and sortContactsByPresence behave deterministically', () => {
  const history: CallHistoryItem[] = [
    {
      id: 'h1',
      ownerUid: 'u1',
      peerUid: 'u2',
      peerName: 'Layla Mansour',
      peerPhoto: '',
      callType: 'video',
      direction: 'outgoing',
      status: 'completed',
      durationSeconds: 185,
      roomCode: 'AAA-1111',
      createdAtMs: 1000,
    },
    {
      id: 'h2',
      ownerUid: 'u1',
      peerUid: 'u3',
      peerName: 'Tariq Zaid',
      peerPhoto: '',
      callType: 'voice',
      direction: 'incoming',
      status: 'missed',
      durationSeconds: 0,
      roomCode: 'BBB-2222',
      createdAtMs: 2000,
    },
  ];
  assert.equal(filterCallHistory(history, 'missed', '').length, 1);
  assert.equal(filterCallHistory(history, 'video', 'layla').length, 1);
  assert.equal(filterCallHistory(history, 'all', 'BBB').length, 1);

  const contacts: FriendContact[] = [
    { friendshipId: 'f1', uid: 'u3', displayName: 'Zaid', handle: 'zaid', bio: '', photoURL: '', presence: 'offline' },
    { friendshipId: 'f2', uid: 'u2', displayName: 'Layla', handle: 'layla', bio: '', photoURL: '', presence: 'online' },
  ];
  const sorted = sortContactsByPresence(contacts);
  assert.equal(sorted[0].uid, 'u2');
  assert.equal(filterContacts(sorted, true, '').length, 1);
});
