# Security Specification & Threat Invariants (Phase 0)

## 1. Data Invariants
1. **PII Isolation**: Private user emails and account settings in `/users/{userId}` can ONLY be read/written by `request.auth.uid == userId`. Searchable directory documents in `/publicProfiles/{userId}` never store emails, phones, or addresses.
2. **Identity Integrity**: Every created `UserPrivate`, `PublicProfile`, `FriendRequest`, `CallSession`, `CallHistoryEntry`, `UserNotification`, and `UserDevice` must set its owner/sender UID strictly equal to `request.auth.uid`.
3. **Immutable Ownership & Timestamps**: `createdAt`, `uid`, `fromUid`, `hostUid`, and `ownerUid` cannot be changed after creation; timestamps must match `request.time`.
4. **Terminal State Locking**: Once a `FriendRequest` leaves `pending` (`accepted` or `rejected`) or a `CallSession` reaches `ended`, subsequent updates are rejected.
5. **Path Hardening & Resource Bounds**: All document IDs match `^[a-zA-Z0-9_\-]+$` with max length 128, and every string field enforces explicit `.size()` bounds.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **PII Cross-Read**: User B reads `/users/userA` (must deny).
2. **Blanket User List**: User B lists `/users` (must deny).
3. **Shadow Field Injection**: Create `/publicProfiles/userA` with extra field `isAdmin: true` (must deny via `hasOnly`).
4. **UID Spoofing on Request**: User A creates `/friendRequests/req1` with `fromUid: "userB"` (must deny).
5. **Self-Friend Request**: User A creates `/friendRequests/req1` with `fromUid: "userA", toUid: "userA"` (must deny).
6. **Orphan Target Request**: User A sends request to non-existent `toUid: "ghost999"` (must deny via `exists()`).
7. **Accepting Another User's Request**: User A updates `/friendRequests/req1` (`toUid: "userB"`) to `accepted` (must deny).
8. **Mutating Ended Call**: Host tries to update `/calls/call1` from `status: "ended"` back to `"active"` (must deny).
9. **Spoofed Timestamp**: Client creates `/users/userA/callHistory/h1` with backdated `createdAt` instead of `request.time` (must deny).
10. **Oversized String DoS**: Client sets `bio` of 2,000 characters in `/publicProfiles/userA` (must deny > 200).
11. **Malformed Document ID**: Client creates `/calls/../../admin` (must deny via `isValidId`).
12. **Unverified Email Write**: Token with `email_verified: false` attempts write (must deny).
