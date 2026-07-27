# Feature Spec: Guest (Non-Member) Booking

Parent: [../SCOPE.md](../SCOPE.md), scope item 13 ("Guest (non-member) booking"). Builds on and reuses functions from [02-email-notifications.md](02-email-notifications.md) (`sendEmail()`), [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md) (`isCoveredForBooker`), and [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md) (`getSlotsForDate`, `isBlackedOut`, the reminder cron).

Status: DRAFT — pending your sign-off before any implementation starts.

"Done" for this feature means: this spec is agreed, automated tests below pass, and a human has walked through the manual verification checklist against the running app.

Stack: Next.js (TypeScript, App Router) + Prisma + Postgres, per the established stack.

---

## GOAL

Let a non-member book a slot entirely on their own — no account, no member sponsorship, no admin approval — while drawing from the *exact same* capacity pool as member bookings, and give admin a way to find and manage any guest booking even if the guest's own access link never arrives. Every rule already decided in `../SCOPE.md` gets enforced here; nothing about *how* a slot becomes bookable changes — only *who* can be the one booking it.

---

## SCOPE

In scope:

1. **Guest booking creation** — public, no login: name, email, phone, chosen slot, optional companion names. Same lead-time/coverage/blackout/capacity rules as member bookings — reusing the exact functions from [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md), not reimplementing them.
2. **Magic-link identity** — a token emailed on booking, letting the guest view/cancel/manage companions for that one booking, valid until 1 hour after the slot ends (per `../SCOPE.md`'s decision).
3. **Companion logging** — mirrors member guest logging, same capacity-bound mechanic.
4. **Admin lookup and management** — find any guest booking by name/email/date/range, cancel it, mark attendance, or create one directly on behalf of a phoned-in guest (same "admin can do it directly" completion already applied to accounts and member bookings).
5. **Reminders** — guest bookings get the same 24h/2h reminder treatment as member bookings, extending the existing cron rather than building a second one.
6. **A reserved (not built) hook for Guest Forms** — per `../SCOPE.md`'s decision to design for it without building it yet.

Out of scope for this spec: Guest Forms themselves (still blocked on real form content from the club — see `../SCOPE.md`), Courses & Competitions guest registration (a separate future spec — will need its own analogous token mechanism once that spec exists, not built here), and guest-booking abuse prevention (rate limiting/CAPTCHA/soft caps — already tracked in `../SCOPE.md`'s Pre-Launch Hardening Checklist, deliberately not solved in this spec).

---

## DATA MODEL (Prisma schema, illustrative)

```prisma
model GuestBooking {
  id                 String            @id @default(cuid())
  rangeId            String
  range              Range             @relation(fields: [rangeId], references: [id])
  name               String
  email              String?           // required for guest self-service creation; may be omitted only when admin creates one directly (see Behaviour)
  phone              String
  startTime          DateTime
  endTime            DateTime
  cancelledAt        DateTime?
  cancelledByAdminUserId String?        // set only on admin-initiated cancellation; a guest's own cancellation via token leaves this null
  createdByAdminUserId   String?        // set only if admin created this directly on the guest's behalf; null for self-service
  attendance         BookingAttendance @default(UNKNOWN) // reuses the enum from 04-slots-booking-and-blackouts.md, not redefined
  reminder24hSentAt  DateTime?
  reminder2hSentAt   DateTime?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  companions         GuestBookingCompanion[]
  tokens             GuestBookingToken[]
  // formSubmissionId String?   -- reserved for the future Guest Forms spec (../SCOPE.md decision), deliberately not modeled further here

  @@index([rangeId, startTime, endTime])
}

model GuestBookingCompanion {
  id             String       @id @default(cuid())
  guestBookingId String
  guestBooking   GuestBooking @relation(fields: [guestBookingId], references: [id])
  name           String
  createdAt      DateTime     @default(now())
}

model GuestBookingToken {
  id             String       @id @default(cuid())
  guestBookingId String
  guestBooking   GuestBooking @relation(fields: [guestBookingId], references: [id])
  tokenHash      String       @unique
  expiresAt      DateTime     // booking.endTime + 1 hour — per ../SCOPE.md's explicit decision
  createdAt      DateTime     @default(now())
}
```

No changes to `Booking`, `Range`, `User`, or any prior model — this spec is purely additive, with one exception noted explicitly in Behaviour: `getRemainingCapacity` (defined in [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md)) must now also count `GuestBooking` rows.

---

## BEHAVIOUR

### ⚠️ Amendment to a previously-defined function, flagged directly
`getRemainingCapacity(rangeId, startTime, endTime)` from [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md) was defined counting only `Booking` rows. It's hereby extended to also sum `GuestBooking` rows (`1 + companion count`) for the same slot — required to honor `../SCOPE.md`'s "same shared capacity pool, first-come-first-served" decision. This is the one place this spec touches a prior spec's contract rather than purely building on top; every other function (`getSlotsForDate`, `isBlackedOut`, `isCoveredForBooker`) is reused completely unchanged.

### Guest booking creation
- `POST /api/guest-bookings` — **public, no auth**. Body: `rangeId`, `startTime`, `endTime`, `name`, `email` (required for self-service), `phone`, `companionNames?: string[]`.
- Validates slot alignment against `getSlotsForDate`, same as member bookings.
- Runs inside the same kind of `SERIALIZABLE` transaction as member booking creation, checking: lead time (2h), `isBlackedOut`, `isCoveredForBooker(rangeId, startTime, endTime, null)` (a guest is never an RSO, so this is always the "not the booker's own shift" branch — no self-supervision consideration ever applies to a guest), and the (now-amended) `getRemainingCapacity`. **No 5-booking-cap-equivalent check** — deliberately, per `../SCOPE.md`'s decision that guest bookings have no concurrent-booking limit in v1 (see Edge Cases and the Pre-Launch Hardening Checklist reference).
- **⚠️ Amended by [06-courses-and-competitions.md](06-courses-and-competitions.md):** once that spec exists, this check list gains a 5th item — `isClaimedByEvent(rangeId, startTime, endTime)` must return `null`, or the booking is rejected naming the claiming event — the identical amendment made to member booking creation in [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md).
- On success: creates the `GuestBooking` + `GuestBookingCompanion` rows, generates a `GuestBookingToken` (`expiresAt = endTime + 1 hour`), and sends `guest-booking-confirmed` (new template, via the existing `sendEmail()`) containing the magic-link URL.
- Same uncancellable-window warning obligation as member bookings — the guest-facing UI consumes the same `GET /api/ranges/:id/slots` endpoint from [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md) and must show the same warning before confirming a slot inside the 2–4h window.

### Guest self-service via magic link
- `GET /api/guest-bookings/manage?token=...` — looks up `GuestBookingToken` by hash; generic "invalid or expired link" if not found or past `expiresAt`. Returns the booking (read-only) if valid — **this endpoint's validity is governed only by the token's own expiry (slot end + 1h), independent of the cancellation cutoff below.**
- `POST /api/guest-bookings/manage/cancel` — body `{ token }`. Token must be valid (per above) **and** `now < startTime - 4 hours` (the same cancellation cutoff as member bookings, including the same intentional 2–4h uncancellable window). These are two distinct checks: a guest can still *view* their booking up until an hour after it ends, but can only *cancel* it up until 4 hours before it starts — a token being valid does not imply the cutoff hasn't already passed.
- `POST /api/guest-bookings/manage/companions` / `DELETE .../companions/:id` — body `{ token, name }` (or companion ID). Same token-validity + cutoff rules as cancellation, same capacity re-check (inside a `SERIALIZABLE` transaction) as member guest-adding.
- **No public "resend my link" endpoint.** Deliberately omitted — a public endpoint that re-sends a booking-access email to an arbitrary submitted email address is a plausible email-enumeration/abuse vector (does a booking exist for this address? does the response differ?) for very little benefit, since the admin lookup below already covers the "guest lost their email" case. See Decisions.

### Admin lookup and management
- `GET /api/admin/guest-bookings?name=&email=&date=&rangeId=` — `requireAdmin`. Partial matching on any subset of these — admin frequently won't have all of them (e.g., only a name given over the phone).
- `POST /api/admin/guest-bookings` — `requireAdmin`. Creates a booking directly on a guest's behalf (e.g. a phone booking) — same shape as guest self-service creation, **except `email` is optional here**:
  - **If the admin has and enters an email** (the guest shared it over the phone) — treated **identically to self-service creation**: a `GuestBookingToken` is generated and `guest-booking-confirmed` is sent, same as if the guest had booked it themselves. There is no reduced/admin-flavored version of this — an admin-entered email gets the guest the exact same confirmation-with-manage-link experience.
  - **If no email is available at all** — no token is generated, no confirmation email sent; admin's own lookup/management remains the only way to view or change that booking.
  - Same override flags as admin's member-booking creation in [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md) apply here too (`overrideLeadTime`, `overrideSelfSupervision` — irrelevant in practice since a guest is never the covering RSO, but kept for consistency of the admin booking-creation contract). **Blackout and zero-RSO-coverage remain non-overridable, identically to member bookings.**
- `POST /api/admin/guest-bookings/:id/cancel` — cancels any guest booking, no cutoff restriction, same as the member equivalent.
- `PATCH /api/admin/guest-bookings/:id/attendance` — same attendance-marking action as member bookings.

### Reminders
- The `send-due-reminders` internal endpoint from [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md) is **extended**, not duplicated, to also scan `GuestBooking` rows using the same `reminder24hSentAt`/`reminder2hSentAt` dedup fields. Sends `guest-booking-reminder-24h`/`guest-booking-reminder-2h` templates, **each including the magic-link URL** so a guest can cancel directly from the reminder without having to dig up the original confirmation email.

### New email templates (added to the mechanism from 02-email-notifications.md)
- `guest-booking-confirmed` — data: `{ name, rangeName, startTime, manageUrl }`.
- `guest-booking-cancelled` — data: `{ name, rangeName, startTime, cancelledByAdmin: boolean }`. Sent only if an email exists on the booking (admin-created bookings without one simply don't get this).
- `guest-booking-reminder-24h` / `guest-booking-reminder-2h` — data: `{ name, rangeName, startTime, manageUrl }`.

---

## EDGE CASES

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | A guest and a member both attempt to claim the last unit of capacity for the same slot at the same instant | Same `SERIALIZABLE`-transaction guarantee as a member-vs-member race in [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md) — exactly one succeeds, regardless of which one is the guest. The capacity check spans both `Booking` and `GuestBooking` within the same transaction. |
| 2 | A guest submits an obviously malformed email at booking time | Rejected with a field-specific validation error, same format-checking as member registration's email field. |
| 3 | A guest follows their manage link more than 1 hour after their slot ended | Rejected — "invalid or expired link," directing them to contact the club (which can look them up via admin search regardless). |
| 4 | A guest's manage link is still within its 1-hour-post-slot validity window, but they try to cancel a booking that started 3 hours ago | The token itself is valid (so the booking is viewable), but cancellation is separately rejected by the 4-hour cutoff check — these are independent gates, not one combined check. |
| 5 | A guest adds companions that would push occupancy over the shared capacity pool | Rejected, race-safe the same way as any other capacity check in this system. |
| 6 | The same person books repeatedly under different (or the same) email address, with no cap enforced | **Not prevented — deliberate, tracked in `../SCOPE.md`'s Pre-Launch Hardening Checklist, not a bug in this spec.** |
| 7 | Admin creates a guest booking over the phone **without** an email address | Allowed — no `GuestBookingToken` is generated, so the guest has no self-service access; admin's own lookup/cancel/attendance actions remain fully available regardless. |
| 7a | Admin creates a guest booking over the phone **with** an email the guest shared verbally | Treated identically to guest self-service creation — a token is generated and `guest-booking-confirmed` is sent with the manage link, exactly as if the guest had booked online themselves. |
| 8 | Admin attempts to create a guest booking with `overrideSelfSupervision` set | Flag is accepted for API-contract consistency with the member-booking admin endpoint, but has no practical effect — a guest is never a covering RSO, so this scenario can't arise for them. |
| 9 | Admin attempts to create a guest booking inside a blackout, or with zero RSO coverage, with any override flag set | Still rejected — identical to the member-booking rule; these are never overridable for anyone. |
| 10 | A guest tries to book a slot on an archived range | Not offered by the shared slot-listing endpoint; a direct API attempt is rejected the same as any invalid range reference. |
| 11 | Admin searches guest bookings with only a partial name, or only an email, or only a date | Returns matching results on whichever fields were actually supplied — not an all-or-nothing exact-match requirement. |
| 12 | A reminder email is sent to a guest | Includes the magic-link URL directly in the reminder, so cancelling doesn't require locating the original confirmation email. |
| 13 | Someone attempts to hit a "resend my confirmation" endpoint | Doesn't exist — deliberately omitted (see Behaviour and Decisions) to avoid an email-enumeration vector; admin lookup is the only recovery path for a lost link. |

---

## ACCEPTANCE CRITERIA

1. A guest can book an available slot with only name/email/phone and no login, subject to the same lead-time/coverage/blackout/capacity rules as a member booking — verified end-to-end with no account or session created anywhere in the process.
2. A concurrency test confirms a guest and a member competing for the last unit of capacity resolve to exactly one winner, regardless of which one is the guest (extends `../SCOPE.md`'s equivalent acceptance criterion for the actual implementation).
3. A guest's manage-link token grants view access until 1 hour after the booking's slot ends, and grants cancel/companion-edit access only until the separate 4-hour-before-start cutoff — verified as two independent boundaries, not one.
4. Adding a companion that would exceed remaining shared capacity is rejected, race-safe under concurrent attempts.
5. Admin can create a guest booking without an email, and that booking is still fully manageable (cancel, attendance) via the admin routes despite having no guest-facing token.
5a. When admin *does* enter an email on an admin-created guest booking, a token is generated and the confirmation email with manage link is sent — verified as byte-for-byte the same trigger as self-service creation, not a degraded/admin-only path.
6. Admin can find a guest booking using any subset of name/email/date/range — not required to supply all four.
7. `send-due-reminders` sends guest reminder emails using the same dedup fields as member bookings, with no duplicate sends across repeated/overlapping cron invocations, and each reminder includes a working manage link.
8. No endpoint exists that reveals whether a given email address has an associated guest booking without also requiring admin authentication — verified by confirming there is no public "resend"/"lookup my booking by email" route.
9. Blackout and zero-RSO-coverage rejections apply identically to guest bookings as to member bookings, including when any admin override flag is set.

---

## TEST PLAN

- **Unit:** the amended `getRemainingCapacity` (member-only, guest-only, and mixed occupancy scenarios); token expiry vs. cutoff as independent boundary checks; email-optional validation branching for admin-created guest bookings.
- **Integration (against a real test Postgres instance):** full guest booking creation → confirmation email with manage link → self-service cancel flow; the guest-vs-member concurrency race as a first-class test; companion add/remove with its own concurrency test; admin search across partial field combinations; admin-created-without-email booking remaining fully manageable; reminder cron covering both `Booking` and `GuestBooking` rows without cross-contamination or duplicate sends.
- **Manual verification checklist (human sign-off, required before this is "done"):**
  1. As a guest (no login), book a slot end-to-end through the actual UI; receive the confirmation email; follow the manage link; view, add a companion, then cancel — all without ever creating an account.
  2. Attempt to book the same last-remaining-capacity slot as a guest and as a logged-in member at the same time (two browser sessions); confirm exactly one succeeds.
  3. As admin, create a guest booking over the phone without an email; confirm it's fully visible/manageable in the admin panel despite the guest having no link of their own.
  4. As admin, search guest bookings by name only, then by email only, then by date only; confirm each returns the expected result.
  5. Manually trigger the reminder endpoint against a guest booking due for its 24h reminder; confirm the email includes a working manage link and isn't duplicated on a second immediate call.
  6. Attempt to use a guest's manage link after the booking's slot has ended by more than an hour; confirm it's rejected as expired.

---

## OUT OF SCOPE (for this spec)

- Guest Forms — still blocked on real content from the club, per `../SCOPE.md`. The reserved (commented-out) hook in the `GuestBooking` model is the only accommodation made here.
- Courses & Competitions guest self-registration — a separate future spec; it will need its own token-based access mechanism analogous to `GuestBookingToken`, not built here (premature to generalize a token system for a registration model that doesn't exist yet).
- Guest booking abuse prevention (rate limiting, CAPTCHA, a soft per-email cap) — already tracked in `../SCOPE.md`'s Pre-Launch Hardening Checklist; deliberately not solved in this spec.
- A public "resend my confirmation/manage link" endpoint — deliberately omitted, see Behaviour and Decisions.

---

## Decisions made while writing this spec (flag if any don't match your intent)

1. **`GuestBooking` is a fully separate table from `Booking`**, not a shared table with nullable member/guest fields — preserves the "guests never touch the member/account model" principle established in [01-accounts-and-ranges.md](01-accounts-and-ranges.md), at the cost of `getRemainingCapacity` needing to query two tables instead of one.
2. **`getRemainingCapacity` is amended to count both tables** — flagged explicitly as the one place this spec touches a previously-defined function's contract, since honoring the "same shared capacity pool" decision requires it.
3. **Email is optional only for admin-created guest bookings, and only when truly unavailable.** If the admin has an email for the guest (shared over the phone), it's entered and treated identically to self-service — same token, same confirmation email. The optionality only covers the case where admin genuinely has no email to give (phone/in-person contact only); a missing magic link isn't a functional gap there since admin's own lookup remains the fallback.
4. **No public resend-link endpoint** — a deliberate omission to avoid an email-enumeration surface; the admin lookup route is the only recovery path for a lost link, which is an acceptable tradeoff given guest bookings are inherently lower-stakes/shorter-lived than member accounts.
5. **Token validity (view access) and the cancellation cutoff (mutate access) are modeled as two independent checks**, not one — a guest should be able to see what they booked even after it's too late to change it.
6. **The existing reminder cron is extended, not duplicated**, for guest bookings — one scheduled job checking both tables rather than two separate ones.
