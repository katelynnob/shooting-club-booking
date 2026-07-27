# Feature Spec: Accounts & Ranges

Parent: [../SCOPE.md](../SCOPE.md), scope items 1 & 2.

Status: DRAFT — pending your sign-off before any implementation starts.

"Done" for this feature means: this spec is agreed, automated tests below pass, and a human has walked through the manual verification checklist against the running app.

Stack: Next.js (TypeScript, App Router) + Prisma + Postgres + NextAuth (Auth.js), deployed per [../SCOPE.md](../SCOPE.md)'s Hetzner VPS / Docker Compose plan.

---

## GOAL

Establish the foundational identity and range-catalog data every other feature (booking, RSO coverage, blackouts, events) depends on: who can log in, what role/status they hold, and what physical ranges exist to be booked against. Nothing in this spec touches booking logic itself — it only builds the ground floor.

---

## SCOPE

In scope:

1. Self-service registration (name, email, password, **required** membership number — see Data Model note) → account created in `PENDING` status.
2. Login via email/password, with status-aware rejection messages (pending/rejected/deactivated).
3. Self-service password reset via emailed link ("forgot password").
4. Admin actions on members: approve, reject, deactivate, reactivate, grant/revoke RSO flag, **directly create a member account (invite by email, member sets their own password via a link)**.
5. **Super Admin** (exactly one, set at deployment time): the only account able to grant/revoke the Admin flag on other users. Regular Admins can do everything else in this spec (member approval, range management) but cannot create or remove other admins.
6. Range catalog: admin CRUD (create, edit, archive/unarchive) on the 6 ranges from [../SCOPE.md](../SCOPE.md), each with capacity (placeholder values, admin-editable), discipline, slot block length, and a per-day-of-week operating-hours schedule.
7. Role-based access control guards reusable by every later feature (`requireAuth`, `requireApprovedMember`, `requireAdmin`, `requireSuperAdmin`).

Out of scope for this spec specifically (each is a separate spec built on top of this one): RSO shift scheduling, ad-hoc slot booking, blackout windows, courses & competitions, email sending infrastructure (though this spec's actions are the future trigger points for those emails).

**Guests/non-members are deliberately absent from this spec, not an oversight.** `../SCOPE.md` scopes a separate Guest Booking capability (self-service slot/event booking with no account, identity via an emailed magic-link token rather than login) — that's a distinct mechanism layered on top of the Range catalog defined here, not an extension of the `User`/`MemberStatus` model in this spec. Nothing here needs to change to accommodate it; it'll be its own spec, consuming `Range` the same way the future booking spec does.

---

## DATA MODEL (Prisma schema, illustrative)

```prisma
enum MemberStatus {
  PENDING
  APPROVED
  REJECTED
  DEACTIVATED
}

enum AccountTokenPurpose {
  INVITE          // admin-created account, member sets their initial password
  PASSWORD_RESET  // self-service "forgot password"
}

model User {
  id                 String       @id @default(cuid())
  email              String       @unique
  passwordHash       String?      // nullable — null means "invited but hasn't set a password yet"; never null once the account can log in at all. See Behaviour: Admin-invited accounts.
  name               String
  membershipNumber   String       @unique // required, not optional — it's the cross-reference key against the club's external membership sheet at approval time. See Behaviour: Registration & Approval.
  status             MemberStatus @default(PENDING)
  isRso              Boolean      @default(false)
  isAdmin            Boolean      @default(false)
  isSuperAdmin       Boolean      @default(false) // exactly one row ever has this true — see Behaviour: Super Admin
  approvedByUserId   String?      // admin who approved this member (or who created/invited them directly) — audit trail for "who confirmed this against the membership sheet"
  approvedAt         DateTime?
  rejectedReason     String?      // free text, admin-entered on reject — e.g. "not found in membership sheet" / "dues lapsed"
  createdAt          DateTime     @default(now())
  updatedAt          DateTime     @updatedAt
  sessionVersion     Int          @default(0) // incremented on deactivate/reactivate/password-reset — see Behaviour: Session strategy (amended during implementation)
  accountTokens      AccountToken[]
}

model AccountToken {
  id          String              @id @default(cuid())
  userId      String
  user        User                @relation(fields: [userId], references: [id])
  purpose     AccountTokenPurpose
  tokenHash   String              @unique // raw token is emailed, only its hash is stored
  expiresAt   DateTime                    // INVITE: issued-at + 7 days; PASSWORD_RESET: issued-at + 1 hour
  usedAt      DateTime?
  createdAt   DateTime            @default(now())
}

model Range {
  id                 String            @id @default(cuid())
  name               String            @unique
  discipline         String
  capacity           Int
  slotLengthMinutes  Int               @default(60)
  archived           Boolean           @default(false)
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  operatingHours     RangeOperatingHours[]
}

model RangeOperatingHours {
  id         String   @id @default(cuid())
  rangeId    String
  range      Range    @relation(fields: [rangeId], references: [id])
  dayOfWeek  Int       // 0 = Sunday .. 6 = Saturday
  openTime   String    // "11:00", stored as local club time (Europe/Dublin) — see Edge Case notes on DST in ../SCOPE.md
  closeTime  String    // "16:00"

  @@unique([rangeId, dayOfWeek])
}
```

**⚠️ Amended during implementation — read before assuming "NextAuth" means database sessions.** This spec originally called for NextAuth database-backed sessions (see the old Open Question #2, now superseded below). That turned out not to work: Auth.js v5's Credentials provider does not reliably support the `"database"` session strategy — this is a structural limitation (the adapter's session-creation flow assumes an OAuth callback handshake that a Credentials sign-in never goes through), documented across multiple long-running upstream GitHub issues, not a version-specific bug to wait out.

**What changed:** JWT session strategy instead, with the `sessionVersion` field above as the revocation mechanism — incremented on deactivate/reactivate/password-reset, embedded in the JWT at login, and checked against the live DB value in Auth.js's `session` callback (which runs on every request regardless of session strategy). A mismatch invalidates the session immediately. This satisfies the exact same requirement the original decision was protecting — Acceptance Criterion #5's "their very next request 401s" — through a different mechanism, not a weaker one.

**A consequence worth flagging: no Auth.js adapter is used at all.** The adapter (`@auth/prisma-adapter`) exists to auto-persist `Account`/`Session`/`VerificationToken` rows for OAuth and database-session flows — none of which this system uses (Credentials-only, JWT sessions, no OAuth, no email magic-link sign-in). Those three tables, and `User.emailVerified`/`User.image` (fields the adapter's documented schema expects but this system never reads), were provisioned during initial scaffolding for adapter compatibility and then removed once it became clear the adapter itself wasn't needed — consistent with this project's broader "don't build the hook until something needs it" pattern (see Guest Forms in `../SCOPE.md` for the same philosophy applied elsewhere). If OAuth sign-in is ever wanted later, those tables and the adapter wiring can be added back in their own migration at that point.

Seed data:
- The 6 ranges from `../SCOPE.md` (Rifle 100m, Rifle 50m Benchrest, Rifle 50m Gallery, Pistol 25m, Clay Pigeon, Archery), each defaulted to Wed/Fri/Sat/Sun 11:00–16:00, 60-minute slots, and a **placeholder capacity** (e.g. 6) per range — admin-editable from day one via `PATCH /api/admin/ranges/:id`, to be corrected once real numbers come from the club.
- Exactly one **Super Admin** user, created by a one-time bootstrap script/seed reading an email from deployment config (e.g. `SUPER_ADMIN_EMAIL` env var) — not created through the normal registration flow. There is deliberately no in-app way to create, transfer, or remove Super Admin status in v1 (see Behaviour: Super Admin) — changing who holds it is a rare, high-consequence action better done as a manual, auditable deployment step than a feature surface.

---

## BEHAVIOUR

### Registration
- `POST /api/auth/register` — body: `email`, `password` (min 8 chars), `name`, `membershipNumber` (**required**). The membership number is required, not optional, because it's the field admin cross-references against the club's external membership records at approval time (see Admin member management, Approve, below) — an optional field would make that check unreliable (name-only matching is fragile: typos, duplicate names, maiden/married names, etc.).
- Email is normalized to lowercase before uniqueness check and storage.
- On success: creates a `User` with `status = PENDING`, `isRso = false`, `isAdmin = false`, and `passwordHash` set immediately (self-registration always supplies a password up front — contrast with Admin-invited accounts below, where `passwordHash` starts `null`). Password stored as a bcrypt hash (cost factor 12), never plaintext, never logged.
- Does **not** create a session — a freshly registered user is not logged in, matching `../SCOPE.md`'s "registration is inert until approved."
- Duplicate email → generic validation error ("An account with this email already exists"), not created.

### Login
- If `passwordHash` is `null` (an admin-invited account that hasn't accepted its invite yet), short-circuit before attempting any password comparison: reject with "This account is awaiting activation — check your email for an invite link, or ask the club to resend it." Never fall through to a bcrypt compare against a null hash.
- Otherwise, NextAuth Credentials provider checks email + password against the stored hash.
- On successful password match, branch on `status`:
  - `PENDING` → login rejected, message: "Your registration is still pending admin approval."
  - `REJECTED` → login rejected, message: "Your registration was not approved. Contact the club if you believe this is a mistake."
  - `DEACTIVATED` → login rejected, message: "This account has been deactivated. Contact the club."
  - `APPROVED` → session created normally.
- Wrong password at any status → generic "incorrect email or password" (never reveal account status to an unauthenticated caller before password is verified, to avoid account-status enumeration).

### Admin member management
- `GET /api/admin/members?status=PENDING|APPROVED|REJECTED|DEACTIVATED` — list view prominently surfaces `name` and `membershipNumber` for every `PENDING` row, since that's exactly what the admin needs on-screen to go check against the club's membership records (currently an external Excel sheet — **not integrated with this system**, per `../SCOPE.md`'s explicit no-integrations decision). This is a manual human judgment call the system supports but does not automate or validate itself.
- `POST /api/admin/members/:id/approve` — `PENDING → APPROVED` only (no-op/error from other states). Records `approvedByUserId` (the calling admin) and `approvedAt` on the row — an audit trail of who vouched for this member and when, given approval now represents "I checked this person against our official membership/dues records," not just "I clicked a button."
- `POST /api/admin/members/:id/reject` — `PENDING → REJECTED` only. Accepts an optional `rejectedReason` (free text) — e.g. "not found in membership sheet" or "dues lapsed" — stored for the club's own record-keeping, not shown to the rejected applicant beyond the generic message.
- `POST /api/admin/members/:id/deactivate` — `APPROVED → DEACTIVATED`; also increments `sessionVersion` so access is revoked immediately (their existing JWT no longer matches the current version, checked on their very next request — see Session strategy below), not just on next token expiry. Blocked entirely against the Super Admin's own account (see Super Admin below).
- `POST /api/admin/members/:id/reactivate` — `DEACTIVATED → APPROVED`.
- `POST /api/admin/members/:id/set-rso` — body `{ isRso: boolean }`, admin-only, any status (flag can be set even if later deactivated, so it's ready if reactivated).
- `PATCH /api/admin/members/:id` — body: any of `name`, `membershipNumber`, `email` — lets admin correct a typo'd membership number or name spotted during the membership-sheet cross-check, without requiring the member to re-register. Same uniqueness/validation rules as registration apply to `email`/`membershipNumber` changes.
- All routes above are gated by `requireAdmin` (Admin or Super Admin), 403 for anyone else.

### Admin-invited accounts
- `POST /api/admin/members/invite` — body: `name`, `email`, `membershipNumber` (all required, same validation/uniqueness as self-registration). Creates a `User` with `status = APPROVED` immediately (skipping `PENDING` — admin creating the account directly *is* the verification, same as an approve action) and `passwordHash = null`. Records `approvedByUserId`/`approvedAt` on the row, same audit fields self-registration's approve flow uses, since this is functionally the same act — an admin vouching for this person against the membership records — just via a different entry point.
- On success: generates an `AccountToken` (`purpose = INVITE`, 7-day expiry), emails an invite link containing the raw token. No session, no password exists yet.
- `POST /api/auth/accept-invite` — body: `{ token, password }`. Looks up the token by hash; rejects with a generic "invalid or expired invite link" if not found, already used, or past expiry (same pattern as password reset, see below). On success: sets `passwordHash`, marks the token used, and **creates a session immediately** (unlike password reset, there's no prior password/session to force out — accepting an invite should log the member straight in rather than making them then separately log in).
- `POST /api/admin/members/:id/resend-invite` — admin-only, only valid while `passwordHash` is still `null`. Invalidates any previous unused `INVITE` tokens for that user and issues a new one with a fresh 7-day expiry, re-sending the email. No-op/error if the account already has a password set (there's nothing to resend).
- Duplicate email at invite time → same generic "already exists" rejection as self-registration; inviting is not a way to reactivate or modify an existing account (use the existing reactivate/edit actions for that).
- This entry point does **not** set `isRso`/`isAdmin` — those are set afterward via the existing `set-rso`/`set-admin` actions, keeping each endpoint doing one thing.

### Super Admin
- Exactly one user has `isSuperAdmin = true`, created once via deployment-time bootstrap (see Seed data above) — never through the app itself.
- `POST /api/admin/members/:id/set-admin` — body `{ isAdmin: boolean }` — gated by a **separate `requireSuperAdmin` guard**, not `requireAdmin`. Regular Admins get 403 here even though they can reach every other `/api/admin/*` route.
- The Super Admin implicitly passes `requireAdmin` checks everywhere (it's a superset), so no admin functionality requires *also* setting `isAdmin = true` on the Super Admin's row.
- No API route can ever set `isSuperAdmin`, deactivate the Super Admin's account, or remove their `isAdmin`-equivalent access. If that ever needs to change, it's a deliberate out-of-band deployment action (direct DB update), not a feature — see Data Model note above for why.

### Password reset
- `POST /api/auth/forgot-password` — body `{ email }`. Always responds with the same generic success message ("if an account exists for that email, a reset link has been sent"), regardless of whether the email matches a user — prevents account-enumeration via this endpoint. If the matched account has `passwordHash = null` (an unaccepted invite), still send a generic success response but email an **invite** link (reissuing/extending the `INVITE` token) rather than a reset link — there's no password yet to reset.
- If the email does match a user with a password already set (any status — reset doesn't care about `PENDING`/`REJECTED`/`DEACTIVATED`, only login does): generates a random token, stores its hash + a 1-hour expiry as an `AccountToken` (`purpose = PASSWORD_RESET`), invalidates any previously-issued unused `PASSWORD_RESET` tokens for that user, and emails a reset link containing the raw token.
- `POST /api/auth/reset-password` — body `{ token, newPassword }`. Looks up the token by its hash, scoped to `purpose = PASSWORD_RESET`; rejects with a generic "invalid or expired link" if not found, already used, past its expiry, or actually an `INVITE`-purpose token. On success: updates `passwordHash`, marks the token used, and **increments `sessionVersion`** (a password reset should force re-login everywhere, same security posture and mechanism as a deactivation).

### Session strategy (amended during implementation — see Data Model note above)
- **JWT sessions**, not database sessions — Auth.js v5's Credentials provider doesn't reliably support the `"database"` strategy; see the Data Model amendment note for the full reasoning.
- Every JWT embeds the user's `sessionVersion` at the time of login (alongside `id`, `status`, `isRso`, `isAdmin`, `isSuperAdmin` — the claims every guard below needs, so they never have to hit the database just to check a role).
- Auth.js's `session` callback runs on every request regardless of strategy — this is where the live DB `sessionVersion` is compared against the token's embedded value. A mismatch means the token was issued before a deactivation/reactivation/password-reset; treat the session as invalid (equivalent to 401) rather than trusting the stale claims.
- This is the mechanism behind "deletes/invalidates all sessions" everywhere else in this spec — there's no session table to delete rows from; invalidation means "increment the counter so old tokens stop matching."

### Access-control guards (shared across all future specs)
- `requireAuth` — valid session **with a `sessionVersion` matching the live DB value** (see Session strategy above), else 401.
- `requireApprovedMember` — valid session (per `requireAuth`) **and** `status === APPROVED`, else 401/403.
- `requireAdmin` — valid session (per `requireAuth`) **and** (`isAdmin === true` **or** `isSuperAdmin === true`), else 403.
- `requireSuperAdmin` — valid session **and** `isSuperAdmin === true`, else 403. Used solely by the admin-role-management route.
- These are implemented once here and reused by every later feature spec (booking, RSO shifts, blackouts, events) rather than re-implemented per route.

### Range management (admin only)
- `GET /api/ranges` — public/member view returns only `archived = false` ranges; `GET /api/admin/ranges` returns all including archived.
- `POST /api/admin/ranges` — create: `name` (unique), `discipline`, `capacity` (positive integer), `slotLengthMinutes` (positive integer, default 60).
- `PATCH /api/admin/ranges/:id` — edit any of the above fields. Changes apply prospectively only — see Edge Cases on retroactivity.
- `POST /api/admin/ranges/:id/archive` / `.../unarchive` — soft delete/restore; archived ranges are never hard-deleted, preserving history for later features (bookings, events) that reference them.
- `PUT /api/admin/ranges/:id/hours` — replaces the full 7-day operating-hours schedule for a range in one call (simpler than per-day PATCHes, and a schedule change is naturally an all-at-once edit).

---

## EDGE CASES

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | Registration with an email that already exists (any status) | Rejected with a generic "already exists" message; no new row created; existing account status is not revealed. |
| 2 | Login attempt against a `PENDING`/`REJECTED`/`DEACTIVATED` account with the correct password | Login rejected with the specific status message; no session created. |
| 3 | Login attempt with the wrong password, regardless of status | Generic "incorrect email or password" — never leaks that the account exists or its status before the password is verified. |
| 4 | A regular Admin tries to call `set-admin` (grant/revoke another user's Admin flag) | 403 — that route is gated by `requireSuperAdmin`, not `requireAdmin`. Only the Super Admin can change who else is an Admin. |
| 5 | Anyone (including the Super Admin) tries to deactivate the Super Admin's account, or any request attempts to change `isSuperAdmin` | Rejected unconditionally — no API path exists for either. The Super Admin's access can't be removed or transferred by the app itself, only by a manual deployment-time change. |
| 6 | A regular Admin tries to deactivate their own account | Rejected outright — prevents accidental self-lockout mid-session. (The Super Admin is separately protected by Edge Case #5 above.) |
| 7 | Admin deactivates a currently-logged-in member | That member's active session(s) are deleted server-side; their next request (even mid-session) gets a fresh 401, not just on next login. |
| 8 | Two ranges created with the same name (case-insensitive) | Rejected at creation with a field-specific validation error. |
| 9 | Admin edits a range's capacity or operating hours while future bookings/events already exist against the old values (booking system not built yet, but the constraint must hold once it is) | Edits apply only to future scheduling computed after the edit; no retroactive mutation or cancellation of existing records — consistent with the "no silent auto-cancel" pattern in `../SCOPE.md`. |
| 10 | Admin archives a range | Hidden from `GET /api/ranges` (member-facing) immediately; still fully queryable via `GET /api/admin/ranges` and by ID for historical reference; not deletable. |
| 11 | Admin sets `isRso = true` on a `PENDING` or `DEACTIVATED` account | Allowed to set now (so it's ready the moment they're approved/reactivated), but has no practical effect until the account reaches `APPROVED` status, since only approved members can be scheduled at all. |
| 12 | An Admin (not Super Admin) is also granted `isRso = true` and later a shift-scheduling feature checks who can cover a slot | Their `isAdmin` flag grants system permissions only — it does **not** by itself count as RSO coverage. Only `isRso === true` counts as a qualified covering RSO, for Admins and Super Admin alike. This is a deliberate decision: system permissions and "is a real qualified range safety officer" are different facts and must not be conflated. |
| 13 | A non-admin, non-RSO member calls any `/api/admin/*` route | 403 from `requireAdmin`, uniformly, regardless of which specific admin route (except `set-admin`, which additionally requires Super Admin — see #4). |
| 14 | `forgot-password` requested for an email that doesn't exist in the system | Same generic "if an account exists..." response as a real match — no enumeration signal either way. |
| 15 | `reset-password` called with an expired token, an already-used token, or a token that never existed | All three return the same generic "invalid or expired link" error — no distinction that would help an attacker narrow down which case it was. |
| 16 | A user requests a password reset twice in a row without using the first link | The first token is invalidated when the second is issued — only the most recently requested reset link ever works. |
| 17 | A password reset succeeds while the user has active sessions elsewhere (e.g. another browser) | `sessionVersion` is incremented, so every existing token stops matching on its next use — same practical effect as a deactivation, and the same "everywhere logged out, log back in with the new password" outcome, just via a version check rather than deleted session rows. |
| 18 | Registration submitted with a blank/whitespace-only `membershipNumber` | Rejected as a validation error, same tier as a missing email — it's now a required field, not optional. |
| 19 | Admin approves a member without actually having checked the external membership sheet (the system cannot detect or prevent this — there's no integration to cross-check against) | Out of the system's control by design — the audit trail (`approvedByUserId`, `approvedAt`) at least records *who* vouched for the member and *when*, so if a bad approval surfaces later there's a clear record to follow up on, even though the check itself can't be enforced in software. |
| 20 | A member's membership number is later found to be wrong/typo'd after approval (e.g. transposed digits) | No system-level reconciliation exists (no integration). Admin corrects it directly via `PATCH /api/admin/members/:id`. |
| 21 | Login attempted against an admin-invited account that hasn't accepted its invite yet (`passwordHash = null`) | Rejected with the specific "awaiting activation" message, checked *before* any password comparison is attempted — never a generic "incorrect password" (which would be actively misleading) and never a crash/500 from comparing against null. |
| 22 | Admin invites an email address that already exists (any status, including another unaccepted invite) | Rejected with the same generic "already exists" message as self-registration; `invite` is only for brand-new emails, never a way to modify or resend to an existing row (use `resend-invite` or `PATCH` for that). |
| 23 | An `accept-invite` token is expired, already used, or never existed | Generic "invalid or expired invite link" — same non-specific pattern as password-reset token failures, no distinction that would help narrow down which case it was. |
| 24 | Admin calls `resend-invite` on an account that already has a password set | Rejected/no-op — there's nothing to resend once the account has been activated; this isn't a way to force a password reset (that's `forgot-password`). |
| 25 | Admin calls `resend-invite` on a still-unaccepted invite | Old unused `INVITE` tokens for that user are invalidated, a new one issued with a fresh 7-day expiry, and the invite email is re-sent — same "only the latest link works" pattern as password reset. |
| 26 | A `reset-password` call is made using a token that is actually `purpose = INVITE` (or vice versa: `accept-invite` called with a `PASSWORD_RESET` token) | Rejected — each endpoint only accepts tokens of its own purpose, even though both live in the same `AccountToken` table. |
| 27 | Two different members are invited/register with the same membership number (typo or genuine duplicate) | Rejected at creation with a field-specific validation error — `membershipNumber` is unique, same tier as the email uniqueness check. |

---

## ACCEPTANCE CRITERIA

1. Registering with a new email creates a `PENDING` user; that user cannot log in until an admin approves them.
2. Registering with an already-used email (any casing) is rejected before any duplicate row is created.
3. Approving a `PENDING` member allows them to subsequently log in and reach authenticated routes.
4. Rejecting a `PENDING` member leaves them permanently unable to log in, with the specific rejection message shown.
5. Deactivating an `APPROVED` member immediately invalidates their existing session — verified by deactivating a member mid-session and confirming their very next request 401s.
6. A regular Admin calling `set-admin` gets 403; only the Super Admin can grant/revoke another user's Admin flag — verified directly against the API, not just hidden in the UI.
7. No API path can deactivate the Super Admin's account or alter `isSuperAdmin` on any row — verified by attempting both as both a regular Admin and as the Super Admin themselves.
8. A regular Admin cannot deactivate their own account, verified by a direct API call, not just hidden in the UI.
9. All passwords are stored as bcrypt hashes — a test inspects the raw DB row and asserts the value is never the plaintext password and matches the `$2b$` bcrypt format.
10. Every `/api/admin/*` route returns 403 for a non-admin caller, and `set-admin` specifically returns 403 for a non-super-admin caller (a table-driven test iterating all admin routes, not one-off spot checks).
11. Creating a range with a duplicate name (any casing) or non-positive capacity is rejected with a field-specific error, not a generic 500.
12. Archiving a range removes it from `GET /api/ranges` but it remains fetchable by ID and via `GET /api/admin/ranges`.
13. Editing a range's capacity/hours does not alter any historical data (tested once the booking spec exists, but the range edit endpoint itself must not attempt any retroactive write in the meantime).
14. A user who never registers cannot trigger a reset email that reveals their non-existence — the `forgot-password` response is byte-for-byte identical whether or not the email matches an account.
15. A used or expired reset token cannot be used to change a password — verified by attempting reuse and by attempting use after the 1-hour expiry.
16. Completing a password reset increments `sessionVersion`, invalidating all of that user's existing tokens on their next use — same mechanism and outcome as the deactivation test in #5.
17. An Admin flagged `isRso = true` who is not also the Super Admin is treated identically to any other RSO for coverage purposes (forward-looking assertion the shift-scheduling spec must honor); an Admin **without** `isRso = true` never counts as coverage regardless of their admin permissions.
18. Registration is rejected if `membershipNumber` is missing or blank, with the same specificity as a missing email.
19. Approving a member records `approvedByUserId` and `approvedAt` on that user's row, queryable later as an audit trail of who vouched for them.
20. The `PENDING` members list surfaces `name` and `membershipNumber` clearly enough for an admin to actually perform the cross-check (a UI-level check, not just an API contract check — include in the manual verification checklist below).
21. Admin can correct a member's `name`/`membershipNumber`/`email` via `PATCH /api/admin/members/:id`, subject to the same uniqueness rules as registration.
22. An admin-invited account is created with `status = APPROVED` and `passwordHash = null`, and cannot log in with any password until the invite is accepted.
23. Accepting a valid invite token sets a real password, marks the token used, and logs the member in immediately (a session exists right after, with no separate login step).
24. A login attempt against a never-accepted invite returns the specific "awaiting activation" message, not a generic wrong-password error, and does so without error regardless of what password string is submitted.
25. `resend-invite` invalidates prior unused invite tokens and re-sends a new one, and is rejected once the account already has a password set.
26. An `INVITE` token cannot be redeemed via `reset-password`, and a `PASSWORD_RESET` token cannot be redeemed via `accept-invite` — verified directly, not just by UI routing.
27. Two accounts cannot share the same `membershipNumber` — verified for both the self-registration and admin-invite creation paths.

---

## TEST PLAN

- **Unit:** password hashing/verification, Zod validation schemas for each endpoint's input, all four access-control guards in isolation (mocked session), reset-token generation/hashing/expiry logic.
- **Integration (API route handlers against a real test Postgres instance, e.g. Dockerized Postgres spun up for CI):** the full registration → pending → approve → login flow; reject flow; deactivate-mid-session flow; Super Admin immutability (deactivate attempt, `isSuperAdmin` mutation attempt); regular-Admin-blocked-from-`set-admin`; range CRUD including archive/unarchive; duplicate-name rejection; 403/401 sweep across all guarded routes; full forgot-password → reset-password → forced-logout flow; token reuse and expiry rejection; full admin-invite → accept-invite → auto-login flow; resend-invite invalidating prior tokens; cross-purpose token rejection (INVITE vs. PASSWORD_RESET); membershipNumber uniqueness across both creation paths.
- **Manual verification checklist (human sign-off, required before this is "done"):**
  1. Register a new account through the actual UI; confirm login fails with the pending message.
  2. As admin, approve it; confirm the same login now succeeds.
  3. As admin, reject a different pending account; confirm its login shows the rejection message.
  4. As admin, deactivate an approved member who is currently logged in elsewhere (two browser sessions); confirm the second session gets kicked out on its next action, not just eventually.
  5. As a regular (non-super) admin, attempt to grant/revoke another user's Admin flag; confirm it's blocked. As the Super Admin, confirm the same action succeeds.
  6. Attempt to deactivate the Super Admin's account, both as another admin and as the Super Admin's own session; confirm both are blocked.
  7. Create, edit, and archive a range through the admin UI; confirm an archived range disappears from wherever members would eventually pick a range, but still shows in the admin range list.
  8. Use "forgot password" end-to-end with a real inbox: request a reset, receive the email, follow the link, set a new password, confirm the old password no longer works and any other open session was logged out.
  9. As admin, open the pending-members list and confirm `name` and `membershipNumber` are both immediately visible without an extra click — this is the actual screen an admin will use side-by-side with the club's Excel sheet, so it needs to be genuinely usable for that, not just technically present.
  10. Correct a deliberately-wrong membership number on a test member via the new edit action; confirm it saves and the uniqueness/validation rules still apply.
  11. As admin, invite a new member by email; confirm they receive an invite email, follow the link, set a password, and land logged in — no separate login step needed. Confirm they could not have logged in at all before accepting.
  12. As admin, resend an invite to someone who hasn't accepted yet; confirm the old link stops working and the new one works. Attempt to resend an invite to someone who already set their password; confirm it's rejected.

---

## OUT OF SCOPE (for this spec)

- RSO shift scheduling (own spec, builds on the `isRso` flag here — and must honor Edge Case #12: Admin permissions alone never count as coverage).
- Ad-hoc slot booking, blackout windows, courses & competitions (own specs, build on the `Range` model here).
- Actual transactional email sending infrastructure (registration/approval/password-reset emails) — this spec creates the trigger *points* and content requirements, but the email-delivery mechanism itself (SMTP provider, templates, retry handling) is a shared piece likely worth its own small spec, since booking reminders will need it too.
- **Rate limiting / brute-force protection on `/api/auth/*` — explicitly deferred**, not forgotten. Tracked in `../SCOPE.md`'s Pre-Launch Hardening Checklist so it resurfaces before go-live rather than being silently dropped.
- Admin UI polish beyond functional CRUD — this spec is about correct behavior, not visual design.
- Any in-app mechanism to create, transfer, or remove Super Admin status — deliberately deployment-only, not a feature (see Data Model / Super Admin above).

---

## Decisions (previously open questions, now resolved)

1. **Password reset:** self-service "forgot password" email link. Implemented above.
2. **Session strategy — superseded during implementation.** Originally confirmed as NextAuth database-backed sessions. Auth.js v5's Credentials provider turned out not to reliably support that strategy (a structural library limitation, not a config mistake). **Now: JWT sessions + a `User.sessionVersion` counter**, checked on every request via Auth.js's `session` callback, incremented on deactivate/reactivate/password-reset. Same immediate-revocation guarantee (Acceptance Criterion #5), different mechanism. See the Data Model note and Session strategy section above for the full reasoning. As a consequence, **no Auth.js adapter is used** — `Account`/`Session`/`VerificationToken`/`User.emailVerified`/`User.image`, provisioned for adapter compatibility during initial scaffolding, were removed once the adapter itself turned out to be unnecessary for a Credentials-only, no-OAuth system.
3. **Rate limiting:** deferred to a later hardening pass, **not dropped** — tracked in `../SCOPE.md`'s Pre-Launch Hardening Checklist, to be resurfaced explicitly before real launch.
4. **Admin model:** one non-demotable **Super Admin**, set at deployment time, who exclusively controls granting/revoking the Admin flag on everyone else. Modeled above via `isSuperAdmin` + `requireSuperAdmin`.
5. **RSO coverage vs. Admin permissions:** confirmed distinct — coverage requires the actual `isRso` flag; being an Admin (or Super Admin) never counts as coverage on its own. Encoded as Edge Case #12 and Acceptance Criterion #17 for the shift-scheduling spec to inherit.
6. **Range capacities:** placeholder values at seed time, admin-editable from day one (already supported by `PATCH /api/admin/ranges/:id`) — to be corrected once real numbers come from the club.
7. **Membership verification at approval:** admin approval now represents "I manually confirmed this person against the club's membership/dues records (currently an Excel sheet, not integrated with this system)." `membershipNumber` is required at registration as the cross-reference key, the pending-members list surfaces it prominently, and approval records an audit trail (`approvedByUserId`/`approvedAt`). The check itself is entirely a human process step outside the system's control — there's nothing to validate against, by design (no integration, per `../SCOPE.md`).
8. **Admin-created ("invited") accounts:** admin can create a member directly (`status = APPROVED` immediately, no `PENDING` step) and the system emails an invite link for the member to set their own password — implemented via a unified `AccountToken` model (shared with password reset, distinguished by `purpose`) rather than a second near-duplicate token table. 7-day expiry (longer than the 1-hour password-reset expiry, since an invite is more likely to sit unread for a few days than an active reset). `membershipNumber` also made unique at the schema level while touching this area, closing a gap that existed even before invites (nothing previously stopped two accounts sharing one).

---

## Decided: one-time gate for v1, ongoing enforcement tracked as a future enhancement

**v1: one-time gate.** Membership is checked once, at initial approval. After that, a member stays `APPROVED` indefinitely regardless of whether they later stop paying dues, unless an admin *manually* notices and deactivates them. No `membershipExpiresAt` field, no automated re-check in v1.

**Future (v2+), not built now:** add a `membershipExpiresAt` date on `User`, admin-set at approval/renewal time, with `requireApprovedMember` also rejecting login once that date has passed (distinct message, e.g. "your membership has expired — contact the club to renew"). Tracked in `../SCOPE.md`'s Future Enhancements list so it isn't forgotten if lapsed dues turn out to be a recurring problem once the club is actually using this day to day.
