# Feature Spec: Slots & Booking (incl. Blackout Windows)

Parent: [../SCOPE.md](../SCOPE.md), scope items 3 ("Slots & booking"), 4 ("Booking cap"), 5 ("Guest logging"), 8 ("Blackout windows"). Builds on [01-accounts-and-ranges.md](01-accounts-and-ranges.md) (accounts, ranges), [02-email-notifications.md](02-email-notifications.md) (`sendEmail()`), and [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md) (`isCoveredForBooker`).

Status: DRAFT — pending your sign-off before any implementation starts.

"Done" for this feature means: this spec is agreed, automated tests below pass, and a human has walked through the manual verification checklist against the running app.

Stack: Next.js (TypeScript, App Router) + Prisma + Postgres, per the established stack.

**Why Blackout Windows is bundled in here rather than its own spec:** it's small (one data model, one admin CRUD, one overlap-check function) and every rule in ad-hoc booking references it directly ("the slot is not inside a blackout window") — same reasoning [01-accounts-and-ranges.md](01-accounts-and-ranges.md) used to bundle Accounts + Ranges together.

---

## GOAL

The core member-facing feature: let an approved member (or, in a later spec, a guest) reserve a specific time slot on a specific range, with every rule already decided in `../SCOPE.md` actually enforced — capacity, RSO coverage, lead time, the intentional 2–4h uncancellable window, the 5-booking cap, blackout windows — and give admin the tools to declare blackouts and see what's gone wrong when a shift or blackout change leaves a booking without coverage.

---

## SCOPE

In scope:

1. **Blackout windows** — admin CRUD (scope: one range, or the whole club), and the `isBlackedOut(rangeId, startTime, endTime)` check every booking attempt runs.
2. **Slot listing** — a computed (not pre-generated/stored) view of a range's bookable time blocks for a given date, annotated with remaining capacity, coverage, blackout status, and whether booking it would land in the uncancellable window.
3. **Booking creation** — for the calling member, enforcing lead time, capacity, RSO coverage, blackout, active-member status, and the 5-booking cap, all inside a single race-safe transaction (see Edge Case #1 — this is the one that actually matters most).
4. **Guest logging** — add/remove guest names on a booking, capacity-bound, up to the same cutoff as cancellation.
5. **Cancellation** — member-initiated, up to the 4-hour cutoff; after that the booking stands and is later marked attended/no-show by staff.
6. **Booking reminders** — the actual mechanism for the 24h/2h emails `../SCOPE.md` already committed to, via a simple protected internal endpoint + OS-level cron (see Behaviour — deliberately not a queue system).
7. **Admin capabilities**: view/filter all bookings, cancel any booking with no cutoff restriction, create a booking directly on behalf of a member (new, flagged below — same "admin can do it directly" completion pattern as account invites), mark attendance, and a **conflicts view** finally closing the loop `../SCOPE.md` and [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md) both deferred: which active bookings have lost RSO coverage or now overlap a blackout.

Out of scope for this spec (separate specs built on top of this one, reusing everything defined here): Guest (non-member) booking, Courses & Competitions, Guest Forms.

---

## DATA MODEL (Prisma schema, illustrative)

```prisma
enum BookingAttendance {
  UNKNOWN
  ATTENDED
  NO_SHOW
}

enum BlackoutScope {
  RANGE
  ALL_RANGES
}

model Booking {
  id                  String            @id @default(cuid())
  rangeId             String
  range               Range             @relation(fields: [rangeId], references: [id])
  memberUserId        String
  member              User              @relation(fields: [memberUserId], references: [id])
  createdByUserId      String           // the member themselves, or an admin booking on their behalf
  startTime           DateTime
  endTime             DateTime
  cancelledAt         DateTime?
  cancelledByUserId   String?
  attendance          BookingAttendance @default(UNKNOWN)
  reminder24hSentAt    DateTime?        // dedup guard for the reminder cron — see Behaviour: Reminders
  reminder2hSentAt     DateTime?
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt
  guests              BookingGuest[]

  @@index([rangeId, startTime, endTime])
  @@index([memberUserId])
}

model BookingGuest {
  id         String   @id @default(cuid())
  bookingId  String
  booking    Booking  @relation(fields: [bookingId], references: [id])
  name       String
  createdAt  DateTime @default(now())
}

model BlackoutWindow {
  id              String        @id @default(cuid())
  scope           BlackoutScope
  rangeId         String?       // required when scope = RANGE, null when ALL_RANGES
  range           Range?        @relation(fields: [rangeId], references: [id])
  startTime       DateTime
  endTime         DateTime
  reason          String        // free text, internal only — never shown to members, see Behaviour
  createdByUserId String
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([rangeId, startTime, endTime])
}
```

No changes to `User`, `Range`, or `RsoShift` from prior specs.

---

## BEHAVIOUR

### Slot generation (computed, not stored)
- `getSlotsForDate(rangeId, date)` — a shared internal function, not just an HTTP concern: reads the range's `RangeOperatingHours` row for that date's day-of-week, slices the open→close window into `slotLengthMinutes`-long blocks starting at the open time. **Timezone-aware** (Europe/Dublin, using a proper timezone library — not naive UTC arithmetic), so this behaves correctly across the DST transition already flagged as `../SCOPE.md` Edge Case #9. Returns an empty list for a day the range isn't open at all.
- `GET /api/ranges/:id/slots?date=YYYY-MM-DD` — public/member-facing (only for non-archived ranges). For each generated slot, returns `{ startTime, endTime, capacityRemaining, isBookable, cancellableIfBooked, reason? }`:
  - `capacityRemaining` — via the shared `getRemainingCapacity(rangeId, startTime, endTime)` function (see below).
  - `isBookable` — `false` if: outside lead time (< 2h from now), `capacityRemaining <= 0`, not covered (`isCoveredForBooker` false for an anonymous/non-RSO caller), or blacked out. `reason` gives a short machine-readable cause (`"lead_time"`, `"full"`, `"no_coverage"`, `"blackout"`) for the frontend to render appropriately — never the blackout's internal `reason` text.
  - `cancellableIfBooked` — `false` if the slot start is less than 4 hours away (the intentional uncancellable window from `../SCOPE.md`) — the frontend must warn with this **before** the member confirms a booking in that window, not after.

### Shared capacity function
- `getRemainingCapacity(rangeId, startTime, endTime): number` — `Range.capacity` minus the sum, over all non-cancelled bookings exactly matching that `[rangeId, startTime, endTime]`, of `1 + count(BookingGuest)`. This is the single source of truth every future spec that shares this capacity pool (Guest Booking, per `../SCOPE.md`'s "same shared pool" decision) must also call — never re-implement this count elsewhere.
- **⚠️ Amended by [05-guest-booking.md](05-guest-booking.md):** once that spec exists, this function also sums `GuestBooking` rows for the same slot — anyone implementing against this spec alone, before Guest Booking is built, gets the member-only version; implementing in full dependency order gets the amended version described there. Don't stop at this spec's text alone if Guest Booking is also in scope.

### Booking creation
- `POST /api/bookings` — `requireApprovedMember`. Body: `rangeId`, `startTime`, `endTime`, `guestNames?: string[]`.
- Validates `startTime`/`endTime` exactly match a slot from `getSlotsForDate` for that range and date — arbitrary, non-aligned time ranges are rejected.
- Runs the following checks **inside a single Postgres `SERIALIZABLE` transaction**, and relies on Postgres to abort the transaction with a serialization failure if a concurrent conflicting booking commits first (see Edge Case #1 — this is not optional, capacity correctness depends on it):
  1. Lead time: `startTime - now >= 2 hours`.
  2. Blackout: `!isBlackedOut(rangeId, startTime, endTime)`.
  3. Coverage: `isCoveredForBooker(rangeId, startTime, endTime, callerUserId)` — from [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md).
  4. Capacity: `getRemainingCapacity(rangeId, startTime, endTime) >= 1 + (guestNames?.length ?? 0)`.
  5. Booking cap: caller currently has fewer than 5 active (`cancelledAt IS NULL AND startTime > now`) bookings.
  6. Caller `status === APPROVED`.
- On serialization failure (i.e. someone else claimed the capacity first, detected by Postgres): catch specifically, return "this slot is no longer available," do **not** retry silently — the member sees a fresh error and can pick another slot, exactly per Edge Case #1's requirement.
- **⚠️ Amended by [06-courses-and-competitions.md](06-courses-and-competitions.md):** once that spec exists, a 7th check is added — `isClaimedByEvent(rangeId, startTime, endTime)` must return `null`, or the booking is rejected with a message naming the claiming event. This spec's list of checks is complete only until Courses & Competitions is also in scope.
- On success: creates the `Booking` + any `BookingGuest` rows, sends the `booking-confirmed` email (see Notifications, below) — a failed email never rolls back the booking, same rule as every other spec.

### Guest logging
- `POST /api/bookings/:id/guests` / `DELETE /api/bookings/:id/guests/:guestId` — `requireApprovedMember`, ownership-checked (`booking.memberUserId === caller`), rejected once past the 4-hour cutoff (same cutoff as cancellation — `../SCOPE.md`: "at booking, or up until the cancellation cutoff"). Adding a guest re-checks `getRemainingCapacity` inside the same kind of `SERIALIZABLE` transaction as booking creation — someone else's booking racing for the same last unit of capacity is exactly as real a scenario here as at creation time.

### Cancellation
- `POST /api/bookings/:id/cancel` — `requireApprovedMember`, ownership-checked, rejected if `now >= startTime - 4 hours`. Sets `cancelledAt`/`cancelledByUserId`; frees capacity immediately for the next booking attempt (no transaction trickery needed here — a cancellation only ever reduces demand, it can't race unsafely).
- Sends the `booking-cancelled` email.

### Reminders — the actual 24h/2h mechanism
- **No queue/worker system** (consistent with [02-email-notifications.md](02-email-notifications.md)'s decision) — instead, `POST /api/internal/send-due-reminders`, protected by a shared secret bearer token (an env var, not a user-facing auth guard), intended to be called every 5 minutes by an OS-level cron entry on the Hetzner VPS (`crontab` + `curl`), not an in-process scheduler.
- On each call: finds active bookings where `startTime` is between 24h and 24h-5min from now and `reminder24hSentAt IS NULL` → sends the `booking-reminder-24h` template, sets `reminder24hSentAt`. Same logic for the 2h window and `reminder2hSentAt`. The timestamp fields are the dedup guard — running the cron twice in overlapping windows (or catching up after a brief outage) never double-sends.

### Notifications (new templates, added to the mechanism from 02-email-notifications.md)
- `booking-confirmed` — data: `{ name, rangeName, startTime, guestNames }`.
- `booking-cancelled` — data: `{ name, rangeName, startTime, cancelledByAdmin: boolean }`.
- `booking-reminder-24h` / `booking-reminder-2h` — data: `{ name, rangeName, startTime }`.
- All sent via the existing `sendEmail()` function from [02-email-notifications.md](02-email-notifications.md) — no new sending mechanism, just new templates and trigger points.

### Blackout windows
- `GET/POST/PATCH/DELETE /api/admin/blackouts` — `requireAdmin`. `scope: RANGE` requires `rangeId`; `scope: ALL_RANGES` requires it to be null. `startTime` strictly before `endTime`.
- `isBlackedOut(rangeId, startTime, endTime)` — true if any `BlackoutWindow` (matching this range, or `ALL_RANGES`) **overlaps** (not necessarily fully contains) the requested window: `blackout.startTime < endTime AND blackout.endTime > startTime`. Any overlap at all makes the slot unbookable, since part of it would be unsafe/unavailable.
- **`reason` is admin-only, internal record-keeping — never surfaced to a member**, even indirectly (the slot-listing endpoint's `reason: "blackout"` field is a fixed string, not the blackout's own text). Same information-hygiene rule already applied to `rejectedReason` in [01-accounts-and-ranges.md](01-accounts-and-ranges.md).
- Creating/editing a blackout does **not** auto-cancel bookings that now overlap it — they surface in the conflicts view below, per `../SCOPE.md`'s existing "no silent auto-cancel" pattern.

### Admin booking management
- `GET /api/admin/bookings?rangeId=&date=&memberUserId=` — filterable list of all bookings, active and historical.
- **New — admin can create a booking directly on behalf of a member**, same completion pattern as admin-invited accounts in [01-accounts-and-ranges.md](01-accounts-and-ranges.md). `POST /api/admin/bookings` — body: `memberUserId`, `rangeId`, `startTime`, `endTime`, `guestNames?`, plus optional override flags: `overrideLeadTime`, `overrideBookingCap`, `overrideSelfSupervision`. Admin can bypass lead time and the 5-booking cap (business/convenience rules) and can specifically let a lone covering RSO book their own slot despite the self-supervision toggle being off (matches `../SCOPE.md`'s literal "a second RSO must be scheduled (or admin overrides)" wording). **Admin can never bypass a genuine blackout or a total absence of RSO coverage** — those represent real unavailability/safety gaps, not business rules, and aren't overridable by anyone in v1.
- `POST /api/admin/bookings/:id/cancel` — cancels any booking, **no cutoff restriction** (unlike the member-facing cancel route) — admin needs to be able to cancel a same-day booking if circumstances require it.
- `PATCH /api/admin/bookings/:id/attendance` — body `{ attendance: ATTENDED | NO_SHOW }`, for bookings staff couldn't cancel (past the cutoff) to be resolved after the fact, per `../SCOPE.md`'s "later marked as attended/no-show by staff."
- **Conflicts view — `GET /api/admin/conflicts`** — finally builds what both `../SCOPE.md` and [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md) deferred, now that `Booking` exists to check against:
  - `uncoveredBookings` — active bookings where `isCoveredForBooker(rangeId, startTime, endTime, memberUserId)` is now `false` (an RSO shift was deleted/shrunk, or an RSO's `isRso` flag was revoked, since that booking was made).
  - `blackedOutBookings` — active bookings where `isBlackedOut(rangeId, startTime, endTime)` is now `true` (a blackout was created/extended after the booking existed).
  - Neither list auto-resolves anything — admin manually cancels/contacts the member as needed, consistent with every other "surface, don't auto-act" pattern in this system.
  - **⚠️ Amended by [06-courses-and-competitions.md](06-courses-and-competitions.md):** once that spec exists, this same endpoint gains two more lists — `uncoveredEvents` and `blackedOutEvents` — applying the identical pattern to events, not just ad-hoc bookings.

---

## EDGE CASES

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | Two members submit a booking for the last unit of remaining capacity at the same instant | The `SERIALIZABLE` transaction ensures exactly one commits; the other's transaction is aborted by Postgres with a serialization failure, caught and surfaced as "slot no longer available" — never a silent overbook, and never two members shown a successful confirmation for one physical spot. |
| 2 | A booking attempt's `startTime`/`endTime` doesn't exactly match a slot returned by `getSlotsForDate` | Rejected — prevents arbitrary or malformed time ranges from ever reaching the capacity/coverage checks. |
| 3 | A member attempts to book within the 2-hour lead time | Rejected with a clear "too close to the slot start" message; the slot also shows as not bookable in the listing endpoint before they even try. |
| 4 | A member attempts to book a slot with zero RSO coverage | Rejected — `isCoveredForBooker` returns `false` (empty covering set), and this is **never** overridable, even by admin. |
| 5 | A member attempts to book a slot inside a blackout | Rejected with a generic "unavailable" message — the blackout's actual `reason` text is never shown to the member, only visible to admin. |
| 6 | A member already at 5 active bookings attempts a 6th | Rejected with a specific, actionable message — unless an admin creates it with `overrideBookingCap: true`. |
| 7 | A member cancels within the 4-hour cutoff (including the 2–4h "uncancellable" window established in `../SCOPE.md`) | Rejected — the booking stands; staff resolve it later via the attendance action. |
| 8 | A member adds a guest that would push occupancy over `getRemainingCapacity` | Rejected at the guest-add step, same race-safety (`SERIALIZABLE` transaction) as booking creation itself — someone else's concurrent booking is a real race here too, not just at creation. |
| 9 | A member tries to add/remove a guest after the 4-hour cutoff | Rejected — guest changes share the same cutoff as cancellation. |
| 10 | Admin creates a booking on behalf of a member who is already at their 5-booking cap, without setting `overrideBookingCap` | Rejected the same as a member would be — the override must be explicit, not implied by being an admin action. |
| 11 | Admin creates a booking with `overrideSelfSupervision: true` for an RSO whose own shift is the *only* coverage | Allowed — this is exactly the scenario `../SCOPE.md` names as admin-overridable. If that RSO's shift doesn't exist at all (zero coverage, not just solo coverage), still rejected regardless of the override flag. |
| 12 | Admin attempts to create a booking inside a blackout, with any override flag set | Still rejected — blackout is not in the list of overridable rules; if admin genuinely needs to let someone through, the correct action is to shrink/edit the blackout window itself, not bypass it silently per-booking. |
| 13 | Admin cancels a booking that's inside the normally-uncancellable 2–4h window | Allowed — the cutoff restriction only applies to the member-facing cancel route, not admin's. |
| 14 | An RSO shift a booking depended on is deleted, or that RSO's `isRso` flag is revoked, after the booking was made | The booking is **not** auto-cancelled; it appears in `GET /api/admin/conflicts` under `uncoveredBookings` on the next check. |
| 15 | A blackout is created overlapping existing bookings | Same treatment — bookings appear under `blackedOutBookings` in the conflicts view, not auto-cancelled. |
| 16 | The reminder cron (`send-due-reminders`) is called twice within the same 5-minute window, or after a brief outage catches up on a missed run | No duplicate sends — `reminder24hSentAt`/`reminder2hSentAt` are set on first send and checked on every call. |
| 17 | A booking's slot spans the DST transition (clocks changing in late March / late October) | `getSlotsForDate` and all lead-time/cutoff/reminder-timing math use timezone-aware arithmetic (Europe/Dublin), tested explicitly against a real DST transition date, not assumed correct from naive UTC math. |
| 18 | Admin lowers a range's capacity below the count of people already booked into an existing future slot | Existing bookings for that slot are **not** retroactively invalidated or cancelled — only new booking/guest-add attempts are checked against the current (lower) capacity value going forward. |
| 19 | A member tries to book a slot on an archived range | Not offered by the slot-listing endpoint at all; a direct API attempt is rejected the same as any other invalid range reference. |
| 20 | `send-due-reminders` is called without the correct shared secret | 401/403 — this is an internal-only endpoint, never reachable by a regular member or admin session. |

---

## ACCEPTANCE CRITERIA

1. A concurrency test (two simultaneous booking attempts against the last unit of capacity, run against a real Postgres instance, not mocked) confirms exactly one succeeds and the other receives a clear "no longer available" error.
2. A booking request with a non-slot-aligned `startTime`/`endTime` is rejected before any capacity/coverage logic runs.
3. A booking inside the 2-hour lead time is rejected, and the same slot is marked `isBookable: false` with `reason: "lead_time"` in the listing endpoint.
4. A booking with zero RSO coverage is rejected for both a regular member and an admin attempting the same booking with any override flags set.
5. A booking inside a blackout is rejected with a generic message; the blackout's `reason` text never appears anywhere in the member-facing response.
6. A 6th concurrent booking attempt by a member at the cap is rejected; the same attempt by admin with `overrideBookingCap: true` succeeds.
7. Cancelling before the 4-hour cutoff frees capacity immediately, verified by a subsequent booking attempt for that exact slot succeeding.
8. Cancelling — or attempting to modify guests — at or after the 4-hour cutoff is rejected via the member route, but the equivalent admin cancel action succeeds regardless of timing.
9. Adding a guest that would exceed remaining capacity is rejected; a concurrency test confirms this is race-safe the same way initial booking creation is.
10. `overrideSelfSupervision` lets a solo-covering RSO book their own slot; the same flag has no effect if that RSO has no shift at all for that window.
11. `GET /api/admin/conflicts` correctly lists a booking under `uncoveredBookings` after its supporting shift is deleted, and under `blackedOutBookings` after a blackout is created over it — verified by constructing both scenarios directly.
12. The reminder cron endpoint never sends a duplicate 24h or 2h reminder for the same booking, verified by invoking it multiple times across overlapping windows.
13. Slot generation and all time-based rules (lead time, cutoff, reminder windows) produce correct results across a real DST transition date, tested explicitly rather than assumed.
14. Lowering a range's capacity does not retroactively affect any existing booking; only booking/guest-add attempts made after the change are checked against the new value.
15. The reminder endpoint rejects any call without the correct shared secret, with no separate "logged in" path around that requirement.

---

## TEST PLAN

- **Unit:** `getSlotsForDate` across normal days, a day the range is closed, and both DST transition dates; `getRemainingCapacity` arithmetic; `isBlackedOut` overlap logic (including partial-overlap, not just full-containment); reminder dedup logic.
- **Integration (against a real test Postgres instance — this spec's concurrency guarantees cannot be verified any other way):** the full booking creation → confirmation email → cancellation → capacity-freed flow; the two-concurrent-bookings-race test as a first-class test, not an afterthought; guest add/remove with its own concurrency test; admin override flows (booking cap, self-supervision, blackout-never-overridable); blackout CRUD and the conflicts view against both an uncovered-booking scenario and a blacked-out-booking scenario; reminder cron idempotency across repeated/overlapping calls.
- **Manual verification checklist (human sign-off, required before this is "done"):**
  1. As a member, view a range's slots for a date; confirm capacity, coverage, and the "won't be cancellable" warning all show correctly before booking.
  2. Book a slot inside the 2–4h window specifically; confirm the UI warns before you confirm, and that cancelling afterward is genuinely blocked.
  3. Have two people (or two browser sessions) attempt to book the literal last unit of capacity for the same slot at the same time; confirm only one succeeds and the other sees a clear message, not an error page.
  4. As admin, create a booking on behalf of a member who's at their 5-booking cap using the override flag; confirm it succeeds, and confirm it fails without the flag.
  5. As admin, create a blackout over an existing booking; confirm the booking still exists and shows up in the conflicts view rather than disappearing.
  6. Manually trigger the reminder endpoint (via curl with the shared secret) against a booking due for its 24h reminder; confirm the email sends once, and confirm calling it again immediately does not send a second copy.
  7. If feasible, test against a real DST transition date (or a manipulated system/test clock) to confirm slot times don't silently shift by an hour.

---

## OUT OF SCOPE (for this spec)

- Guest (non-member) booking — separate spec, reuses `getSlotsForDate`, `getRemainingCapacity`, `isCoveredForBooker`, and `isBlackedOut` exactly as defined here rather than re-implementing any of them.
- Courses & Competitions, Guest Forms — separate specs.
- A queue/worker system for reminders or emails generally — the OS-level cron + protected endpoint approach is deliberately simple; revisit only if it proves insufficient in practice.
- Any UI/calendar visualization — this spec is the API/data layer.
- Rate limiting on the public slot-listing endpoint — lower priority than the auth/guest-booking rate limiting already tracked in `../SCOPE.md`'s Pre-Launch Hardening Checklist, but worth adding to that same checklist rather than building now.

---

## Decisions made while writing this spec (flag if any don't match your intent)

1. **Concurrency safety via Postgres `SERIALIZABLE` transactions, not a separate semaphore/lock table.** The simplest correct approach for this scale — no extra infrastructure, and Postgres's own conflict detection is exactly the mechanism this needs.
2. **Slots are computed on demand, never pre-generated/stored rows.** Avoids a slot table needing to stay in sync with schedule changes; a booking just stores its own `startTime`/`endTime`, validated at creation against a freshly-computed slot list.
3. **Admin's override powers are split explicitly: lead time, booking cap, and the self-supervision-solo-RSO case are overridable; blackout and total absence of RSO coverage are never overridable, by anyone.** This distinction wasn't fully spelled out in `../SCOPE.md` (which only mentioned the self-supervision override) — I've drawn the line at "business rules are overridable, physical safety/availability facts are not."
4. **Reminders sent via OS-level cron + a shared-secret-protected internal endpoint**, not an in-process scheduler or job queue — consistent with the "no queue system" decision already made in [02-email-notifications.md](02-email-notifications.md).
5. **The admin conflicts view (`GET /api/admin/conflicts`) is built now**, closing the loop deliberately left open in both `../SCOPE.md` and [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md) — this is the first spec where a `Booking` model actually exists to check against.
6. **A blackout's `reason` field is never exposed to members under any circumstance**, including indirectly through the slot-listing endpoint — same information-hygiene rule already applied to `rejectedReason` for member accounts.
7. **No explicit per-booking cap on guest count beyond capacity itself** — consistent with there being no such cap stated anywhere in `../SCOPE.md`.
