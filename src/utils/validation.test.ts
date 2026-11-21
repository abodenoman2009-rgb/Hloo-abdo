import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInitialUserRecords,
  clampDurationSeconds,
  deriveDefaultHandle,
  isSafeMediaUrl,
  isValidHandle,
  isValidId,
  isValidRoomCodeFormat,
  mapFirebaseAuthErrorMessage,
  sanitizeBio,
  sanitizeDisplayName,
  sanitizeHandle,
  sanitizeRoomCode,
} from './validation';

test('isValidId enforces alphanumeric/hyphen/underscore and max 128 chars', () => {
  assert.equal(isValidId('user_123-abc'), true);
  assert.equal(isValidId('../etc/passwd'), false);
  assert.equal(isValidId(''), false);
  assert.equal(isValidId('a'.repeat(129)), false);
});

test('sanitizeDisplayName collapses whitespace and enforces max length', () => {
  assert.equal(sanitizeDisplayName('  Layla   Mansour  '), 'Layla Mansour');
  assert.equal(sanitizeDisplayName('x'.repeat(120)).length, 80);
});

test('sanitizeHandle & isValidHandle normalize handles properly', () => {
  assert.equal(sanitizeHandle(' @Tariq.Design! '), 'tariq.design');
  assert.equal(isValidHandle('tariq.design'), true);
  assert.equal(isValidHandle('a'), false);
  assert.equal(deriveDefaultHandle('abodenoman2004@gmail.com', 'uid987654'), 'abodenoman2004_uid987');
});

test('sanitizeRoomCode & isValidRoomCodeFormat enforce XXX-XXXX style codes', () => {
  assert.equal(sanitizeRoomCode(' abc-1234! '), 'ABC-1234');
  assert.equal(isValidRoomCodeFormat('ABC-1234'), true);
  assert.equal(isValidRoomCodeFormat('ab'), false);
});

test('isSafeMediaUrl blocks javascript: and data: URIs while permitting https and local generated assets', () => {
  assert.equal(isSafeMediaUrl('https://lh3.googleusercontent.com/a/avatar'), true);
  assert.equal(isSafeMediaUrl('/src/assets/images/avatar_layla_1795287157992.jpg'), true);
  assert.equal(isSafeMediaUrl('javascript:alert(1)'), false);
  assert.equal(isSafeMediaUrl('data:text/html,<script>alert(1)</script>'), false);
});

test('sanitizeBio and clampDurationSeconds respect blueprint bounds', () => {
  assert.equal(sanitizeBio('a'.repeat(300)).length, 200);
  assert.equal(clampDurationSeconds(-5), 0);
  assert.equal(clampDurationSeconds(120.8), 120);
  assert.equal(clampDurationSeconds(999999), 86400);
});

test('buildInitialUserRecords produces blueprint-compliant private and public Firestore docs', () => {
  const records = buildInitialUserRecords({
    uid: 'googleUid_12345',
    email: 'abodenoman2004@gmail.com',
    displayName: '  Abode   Noman  ',
    photoURL: 'https://lh3.googleusercontent.com/a/photo',
    preferredLanguage: 'ar',
    preferredTheme: 'dark',
  });

  assert.equal(records.privateUser.uid, 'googleUid_12345');
  assert.equal(records.privateUser.email, 'abodenoman2004@gmail.com');
  assert.equal(records.privateUser.displayName, 'Abode Noman');
  assert.equal(records.privateUser.preferredLanguage, 'ar');
  assert.equal(records.publicProfile.presence, 'online');
  assert.equal(records.publicProfile.isDiscoverable, true);
  assert.equal(isValidHandle(records.publicProfile.handle), true);

  const sanitizedFallback = buildInitialUserRecords({
    uid: 'uid_2',
    email: 'someone@example.com',
    displayName: '',
    photoURL: 'javascript:alert(1)',
    preferredLanguage: 'en',
    preferredTheme: 'light',
  });
  assert.equal(sanitizedFallback.privateUser.displayName, 'someone');
  assert.equal(sanitizedFallback.privateUser.photoURL, '');
});

test('mapFirebaseAuthErrorMessage localizes common Google Sign-In failure codes', () => {
  assert.match(
    mapFirebaseAuthErrorMessage({ code: 'auth/popup-blocked' }, 'en'),
    /popup was blocked/i
  );
  assert.match(
    mapFirebaseAuthErrorMessage({ code: 'auth/popup-closed-by-user' }, 'ar'),
    /إغلاق نافذة/
  );
});

