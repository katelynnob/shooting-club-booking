# Feature Spec: Courses & Competitions

Parent: [../SCOPE.md](../SCOPE.md), scope item 9 ("Courses & competitions"). Builds on every prior spec: [01-accounts-and-ranges.md](01-accounts-and-ranges.md), [02-email-notifications.md](02-email-notifications.md), [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md), [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md), [05-guest-booking.md](05-guest-booking.md). This is the last feature in the original `../SCOPE.md` list.

Status: DRAFT — pending your sign-off before any implementation starts.

"Done" for this feature means: this spec is agreed, automated tests below pass, and a human has walked through the manual verification checklist against the running app.

Stack: Next.js (TypeScript, App Router) + Prisma + Postgres, per the established stack.

---

## GOAL

Let admin schedule the club's beginner courses and competitions as **events** distinct from ad-hoc slot booking — spanning one or more ranges (or the whole club) for a fixed window — with members, guests, and phoned-in newcomers all able to register through the appropriate path, while making sure an event's range(s) can't be double-claimed by an ad-hoc booking at the same time.

---

## ⚠️ Amendment to two previously-defined booking-creation flows — flagged directly, read before anything else

`../SCOPE.md`'s own decision: **"Registering for an event on a range blocks ad-hoc slot booking on that range for its duration."** This means both `POST /api/bookings` ([04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md)) and `POST /api/guest-bookings` ([05-guest-booking.md](05-guest-booking.md)) must be amended to run one more check: a new `isClaimedByEvent(rangeId, startTime, endTime): Event | null` function, defined in this spec. If it returns an event, the booking attempt is rejected — and critically, **the rejection message names the event** ("Rifle 100m is reserved for Beginner Rifle Course, 9am–1pm"), unlike a blackout rejection, which stays generic. This is the second cross-spec amendment in this series (the first was `getRemainingCapacity` in [05-guest-booking.md](05-guest-booking.md)) — every other function from prior specs (`getSlotsForDate`, `getRemainingCapacity`, `isBlackedOut`, `isCoveredForBooker`, the reminder cron) is reused completely unchanged.

---

## SCOPE

In scope:

1. **Event creation/management** (admin) — course or competition, one or more ranges or "whole club", start/end time, capacity, description, optionally a directly-assigned RSO/instructor.
2. **Member registration/withdrawal**, subject to event capacity and a 48-hour withdrawal cutoff (distinct from ad-hoc booking's 4-hour cutoff) — does **not** count against the member's 5-active-booking cap.
3. **Guest self-registration**, same token-link identity model as ad-hoc Guest Booking — the primary path for a newcomer signing up for a beginner course.
4. **Admin-added placeholder registrants** — name + contact only, for anyone who signed up by phone/email instead of self-service, preserving `../SCOPE.md`'s explicit three-way distinction between a full member, a self-service guest, and a placeholder (see Behaviour — this is a deliberate difference from how ad-hoc Guest Booking treats an admin-entered email).
5. **Companion logging** for member and guest registrants (not placeholders), mirroring ad-hoc guest logging.
6. **Event/ad-hoc mutual exclusion** — the amendment above.
7. **Cancel, reschedule, and duplicate** an event.
8. **Conflicts view extension** — events that have lost RSO coverage or now overlap a blackout, added to the same `GET /api/admin/conflicts` endpoint from [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md).

Out of scope: Guest Forms (still blocked on real content from the club), payment, any automated recurring-series engine (duplicate-event remains the answer per `../SCOPE.md`), waitlisting a full event.

---

## DATA MODEL (Prisma schema, illustrative)

```prisma
enum EventType {
  COURSE
  COMPETITION
}

enum RegistrantKind {
  MEMBER
  GUEST
  PLACEHOLDER
}

model Event {
  id                String     @id @default(cuid())
  type              EventType
  title             String
  description       String
  startTime         DateTime
  endTime           DateTime
  capacity          Int                  // separate from any range's own per-slot capacity
  wholeClub         Boolean    @default(false) // true = blocks every range for the duration; false = only the ranges below
  assignedRsoUserId String?              // admin's direct designation of a responsible RSO/instructor — see Behaviour: Coverage
  assignedRso       User?      @relation(fields: [assignedRsoUserId], references: [id])
  cancelledAt       DateTime?
  cancelledByUserId String?
  createdByUserId   String
  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt
  ranges            EventRange[]
  registrations     EventRegistration[]

  @@index([startTime, endTime])
}

model EventRange {
  id      String @id @default(cuid())
  eventId String
  event   Event  @relation(fields: [eventId], references: [id])
  rangeId String
  range   Range  @relation(fields: [rangeId], references: [id])

  @@unique([eventId, rangeId])
}

model EventRegistration {
  id                String          @id @default(cuid())
  eventId           String
  event             Event           @relation(fields: [eventId], references: [id])
  kind              RegistrantKind
  memberUserId      String?         // set when kind = MEMBER
  member            User?           @relation(fields: [memberUserId], references: [id])
  guestName         String?         // set when kind = GUEST or PLACEHOLDER
  guestEmail        String?         // GUEST: required for self-service; PLACEHOLDER: optional, and never grants self-service regardless (see Behaviour)
  guestPhone        String?
  createdByUserId   String?         // set when admin created/added this registration; null for self-service member/guest registration
  withdrawnAt       DateTime?
  withdrawnByUserId String?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt
  companions        EventRegistrationCompanion[]
  tokens            EventRegistrationToken[]        // only ever created for kind = GUEST

  @@index([eventId])
  @@unique([eventId, memberUserId]) // a member can only have one (non-superseded) registration per event
}

model EventRegistrationCompanion {
  id             String            @id @default(cuid())
  registrationId String
  registration   EventRegistration @relation(fields: [registrationId], references: [id])
  name           String
  createdAt      DateTime          @default(now())
}

model EventRegistrationToken {
  id             String            @id @default(cuid())
  registrationId String
  registration   EventRegistration @relation(fields: [registrationId], references: [id])
  tokenHash      String            @unique
  expiresAt      DateTime          // event.endTime + 1 hour, mirroring GuestBookingToken from 05-guest-booking.md
  createdAt      DateTime          @default(now())
}
```

No changes to `Booking`, `GuestBooking`, `RsoShift`, `BlackoutWindow`, `User`, or `Range` beyond the new relations shown above and the `isClaimedByEvent` amendment described up top.

---

## BEHAVIOUR

### Event creation and editing (admin only)
- `POST /api/admin/events` — `requireAdmin`. Body: `type`, `title`, `description`, `startTime`, `endTime`, `capacity`, and either `wholeClub: true` or `rangeIds: string[]` (non-empty, all non-archived), plus optional `assignedRsoUserId`.
- `PATCH /api/admin/events/:id` — edits any field. If `startTime`/`endTime` change, every active registrant is sent an `event-rescheduled` email (see Notifications) — the roster is **not** wiped, unlike a cancellation.
- **Coverage is not a creation-time gate — deliberately, see Decisions.** An event can be created without any RSO shift yet existing for its range(s)/window, since events are routinely scheduled weeks ahead of shift rosters. Whether an event is *currently* covered is instead a live, continuously-recomputed fact, surfaced through the conflicts view (below) — most usefully as the event date actually approaches.
- **Exception: a `wholeClub` event requires `assignedRsoUserId` at creation.** There's no specific range list to check shift-coverage against for a club-wide event, so relying on "every range has a shift" doesn't make sense the way it does for a scoped event — a wholeClub event must name a directly responsible RSO/instructor instead.
- **Coverage definition, once it matters (conflicts view, and eventually a "is this event ready" indicator):** an event is considered covered if **either** `assignedRsoUserId` is set (and that user currently has `isRso === true`) **or**, for a non-wholeClub event, every one of its `EventRange` entries has `getCoveringRsoIds` return non-empty for the full event window (from [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md)). The self-supervision toggle has no bearing here — there's no single "booker" whose own shift needs excluding the way there is for an individual ad-hoc booking; the question for an event is simply "does at least one qualified person show up to run it."
- Reducing `capacity` below the current registrant count does **not** remove anyone — it only blocks *new* registrations until natural withdrawals bring the count back under, consistent with the "no retroactive punishment" pattern used everywhere else in this system.

### Member registration and withdrawal
- `POST /api/events/:id/register` — `requireApprovedMember`. Rejected if: the event is cancelled, has already started, is full (`SERIALIZABLE`-transaction-protected, same race-safety as every other capacity check in this system), or the member already has a non-withdrawn `MEMBER`-kind registration for this event (the `@@unique([eventId, memberUserId])` constraint backs this). **Does not count against the 5-active-booking cap** — tracked entirely separately from `Booking`.
- `POST /api/events/:id/withdraw` — ownership-checked, rejected once `now >= startTime - 48 hours` (the event-specific cutoff from `../SCOPE.md`, distinct from ad-hoc booking's 4-hour cutoff).
- `POST /api/events/registrations/:id/companions` / `DELETE .../companions/:id` — same ownership + 48-hour-cutoff rule, same capacity race-safety as registration itself.

### Guest self-registration
- `POST /api/events/:id/register-guest` — **public, no auth**. Body: `name`, `email` (required), `phone`, `companionNames?`. Creates an `EventRegistration` (`kind = GUEST`), generates an `EventRegistrationToken` (`expiresAt = event.endTime + 1 hour`, same pattern as [05-guest-booking.md](05-guest-booking.md)), sends `event-registration-confirmed` with the manage link.
- `GET /api/events/registrations/manage?token=` / `POST .../withdraw` / `POST|DELETE .../companions` — same token-vs-cutoff distinction as `GuestBookingToken`: the token governs *view* access (until event end + 1h), the 48-hour cutoff separately governs *withdraw*/companion-edit access.

### Admin-added registrants — placeholder vs. full guest, a deliberate distinction
- `POST /api/admin/events/:id/registrations` — `requireAdmin`. Body is either `{ memberUserId }` (admin registers an existing member on their behalf — `kind = MEMBER`) or `{ kind: 'GUEST' | 'PLACEHOLDER', name, email?, phone? }`.
  - **`kind: 'PLACEHOLDER'`** — matches `../SCOPE.md`'s explicit design: a bare record for anyone who signed up by phone/email. **Never gets an `EventRegistrationToken`, ever — even if `email` is captured.** No self-service view/withdraw/companion-management, full stop. This is a deliberate difference from ad-hoc Guest Booking's admin-creation path (where an admin-entered email *does* trigger full self-service treatment) — `../SCOPE.md` draws a genuine three-way line for events (member / self-service guest / admin-only placeholder) that ad-hoc booking never had, and this spec preserves that distinction rather than collapsing it for consistency's sake.
  - **`kind: 'GUEST'`** — admin explicitly choosing to register someone *as* a self-service guest on their behalf (e.g. taking their email over the phone and wanting them to have manage-link control) — this does generate a token and send the confirmation, identical to the guest self-registration path. Admin picks whichever kind fits the actual conversation they had.
  - Either way, admin can still **add companions on the registrant's behalf** — the `../SCOPE.md` line "cannot bring guests of their own" is read as *no self-service* guest-adding for a placeholder (which they have no access to anyway, being tokenless), not an absolute ban on admin recording that a placeholder registrant is bringing someone.
- `POST /api/admin/events/:id/registrations/:regId/withdraw` — admin can withdraw **any** registrant (member, guest, or placeholder), **at any time**, no 48-hour restriction — matches `../SCOPE.md`'s explicit distinction between admin's unrestricted removal power and a self-service registrant's own cutoff-bound withdrawal.

### Cancel, reschedule, duplicate
- `POST /api/admin/events/:id/cancel` — cancels the whole event. Every active `MEMBER`/`GUEST` registrant with a known email gets `event-cancelled`; any `PLACEHOLDER` (or `GUEST` registered without an email, if that's ever possible — it isn't, email is required for guest self-registration, but an admin-created placeholder might lack one) is returned in the response as a **"contact these people directly"** list for admin, since the system has no way to reach them. Companions are dropped along with their parent registration implicitly (an event's registrations table isn't separately cleaned up — checking "is this registration active" already considers `event.cancelledAt`).
- **Reschedule is just `PATCH` with a new `startTime`/`endTime`** — deliberately not a separate action; see Behaviour above (roster preserved, `event-rescheduled` sent instead of releasing anyone).
- `POST /api/admin/events/:id/duplicate` — body: `{ startTime, endTime }` (**required**, not optional). Creates a new, independent `Event` copying `type`/`title`/`description`/`capacity`/`ranges or wholeClub`/`assignedRsoUserId`, with an **empty roster**, immediately usable at the new time. Requiring the new time in the same call (rather than `../SCOPE.md`'s slightly looser "admin must set a new date/time before it's usable") avoids ever having a half-configured, ambiguous draft event sitting in the system.

### Event ↔ ad-hoc booking mutual exclusion
- `isClaimedByEvent(rangeId, startTime, endTime): Event | null` — returns the first non-cancelled event whose window overlaps `[startTime, endTime)` and whose range list includes `rangeId` (or is `wholeClub`). Called by both `POST /api/bookings` and `POST /api/guest-bookings` (amendment flagged at the top of this spec) — if non-null, the booking attempt is rejected with a message naming that event's `title`.
- The reverse is also true and already covered by the registration logic above: a member/guest who has registered for an event cannot *separately* ad-hoc-book the same range during the event window — they'd simply hit the same `isClaimedByEvent` rejection as anyone else attempting it, there's no special case needed for "it's their own event."

### Conflicts view extension
`GET /api/admin/conflicts` (from [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md)) gains two more lists:
- `uncoveredEvents` — active, not-yet-ended events that no longer satisfy the coverage definition above (an assigned RSO's `isRso` was revoked, or a shift a scoped event was relying on was deleted/shrunk).
- `blackedOutEvents` — active events whose range(s)/window now overlap a `BlackoutWindow` created after the event existed.
- Same "surface, never auto-act" pattern as everywhere else in this system.

### New email templates (added to the mechanism from 02-email-notifications.md)
- `event-registration-confirmed` — data: `{ name, eventTitle, startTime, manageUrl? }` (`manageUrl` present only for `GUEST`-kind registrations).
- `event-registration-withdrawn` — data: `{ name, eventTitle, startTime }`.
- `event-cancelled` — data: `{ name, eventTitle, originalStartTime }`.
- `event-rescheduled` — data: `{ name, eventTitle, oldStartTime, newStartTime }`.

---

## EDGE CASES

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | A member or guest attempts an ad-hoc booking on a range/time already claimed by an event | Rejected via `isClaimedByEvent`; the message names the event, unlike a blackout rejection's generic wording. |
| 2 | Admin creates an event on a range/time that already has existing ad-hoc bookings | Not auto-cancelled — those bookings now appear in `GET /api/admin/conflicts` (extends the concept from [04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md), though this specific direction — event-created-over-bookings — isn't a new conflicts-view *category*, it's the existing ad-hoc-booking-conflict logic simply also triggered by an event's range-claim, not just a blackout). |
| 3 | An event fills to capacity | Further registration attempts (member, guest, or admin-added) rejected with remaining-seats info; race-safe under concurrent attempts. |
| 4 | Admin cancels an event with a mix of member, guest, and placeholder registrants | Members and guests with known emails are notified automatically; placeholders (or the rare guest without an email) are surfaced as a manual-contact list, not silently dropped. |
| 5 | Admin reschedules an event (date/time change only) | Roster is untouched; every active registrant gets `event-rescheduled`, not `event-cancelled`. |
| 6 | A member registers for an event, then separately tries to ad-hoc-book the same range during the event window | Rejected the same as anyone else via `isClaimedByEvent` — no special-casing for "it's their own event." |
| 7 | Admin adds a placeholder registrant, and that same person later joins as a full member | Treated as entirely unrelated records — no automatic linking or merging; admin can note it manually if it matters. |
| 8 | Admin withdraws a placeholder registrant vs. a member withdrawing themselves | Admin can withdraw any registrant, any time. A member/guest can only withdraw their own registration, and only before the 48-hour cutoff. |
| 9 | Admin duplicates an event | New event created immediately with the required new `startTime`/`endTime`, empty roster, only descriptive fields copied — never an ambiguous half-configured draft. |
| 10 | A guest self-registers for an event, and admin separately also adds them as a placeholder for the same event (e.g. they called *and* used the online form) | No automatic dedup — two distinct `EventRegistration` rows exist; admin resolves manually by withdrawing one. |
| 11 | Admin attempts to create a `wholeClub` event without an `assignedRsoUserId` | Rejected at creation — there's no specific range list to fall back on checking shift coverage against. |
| 12 | A scoped (non-wholeClub) event is created with no `assignedRsoUserId` and no RSO shift yet exists for its range(s) | **Allowed to create** — coverage isn't a creation gate (see Behaviour/Decisions); it surfaces in `uncoveredEvents` if still true as the date approaches, giving admin visibility without blocking legitimate advance scheduling. |
| 13 | Admin creates a `PLACEHOLDER` registrant with a captured email, then the guest asks "can I manage my own registration online" | No — placeholders never get self-service, regardless of contact info captured. If self-service access is wanted, admin should have used `kind: 'GUEST'` instead. |
| 14 | Admin reduces an event's capacity below its current registrant count | No existing registrant is removed; only new registration attempts are blocked until withdrawals bring the count back under. |
| 15 | A member tries to register for the same event twice | Rejected — one non-withdrawn `MEMBER`-kind registration per member per event, enforced at the schema level. |
| 16 | A member or guest registrant adds companions that would exceed the event's remaining capacity | Rejected, race-safe the same way as every other capacity check in this system. |
| 17 | Admin adds a companion name to a `PLACEHOLDER` registration on the registrant's behalf | Allowed — the restriction is on *self-service* guest-adding (which placeholders don't have access to anyway), not an absolute ban on admin recording it for them. |
| 18 | An event's `assignedRsoUserId` later has their `isRso` flag revoked | The event becomes uncovered; surfaces in `uncoveredEvents` on the next conflicts check — mirrors the equivalent ad-hoc-booking edge case from [03-rso-shift-scheduling.md](03-rso-shift-scheduling.md)/[04-slots-booking-and-blackouts.md](04-slots-booking-and-blackouts.md). |
| 19 | Registration is attempted for an event that has already started or ended | Rejected — you can't register for something already underway or finished. |
| 20 | Registration is attempted for a cancelled event | Rejected. |

---

## ACCEPTANCE CRITERIA

1. An ad-hoc booking attempt (member or guest path) on a range/time claimed by an event is rejected with a message naming the event, verified for both `POST /api/bookings` and `POST /api/guest-bookings`.
2. A concurrency test confirms event registration capacity is race-safe — two simultaneous registration attempts for the last seat resolve to exactly one success.
3. Cancelling an event notifies every member/guest registrant with a known email and returns a distinct list of placeholder/no-email registrants for admin to contact manually.
4. Rescheduling an event (via `PATCH` changing times) preserves the roster and sends `event-rescheduled`, never `event-cancelled`.
5. A member cannot register twice for the same event; a member cannot ad-hoc-book a range/time their own event registration already occupies.
6. Admin can withdraw any registrant at any time; a member/guest can only withdraw their own registration and only before the 48-hour cutoff — verified directly against the API for both actor types.
7. Duplicating an event requires and applies a new `startTime`/`endTime` in the same call, copies only descriptive fields, and starts with zero registrations.
8. A `PLACEHOLDER`-kind registration never receives an `EventRegistrationToken`, regardless of whether an email was captured for it; a `GUEST`-kind registration with an email always does.
9. Creating a `wholeClub` event without `assignedRsoUserId` is rejected; creating a scoped event without any coverage in place is *not* rejected, and instead surfaces in `uncoveredEvents` if still uncovered as checked later.
10. Reducing an event's capacity below its current registrant count does not remove any existing registration.
11. `GET /api/admin/conflicts` correctly lists an event under `uncoveredEvents` after its assigned RSO's flag is revoked (or a relied-upon shift is deleted), and under `blackedOutEvents` after a blackout is created over it.
12. Admin can add a companion to a placeholder registration on that registrant's behalf, even though the placeholder itself has no self-service access to do so.

---

## TEST PLAN

- **Unit:** `isClaimedByEvent` overlap/range-matching logic (including the `wholeClub` case); the event coverage definition (assigned-RSO vs. per-range-shift paths); placeholder-vs-guest token-issuance branching.
- **Integration (against a real test Postgres instance):** full event creation → member registration → withdrawal flow; guest self-registration → manage-link → withdraw flow; the registration-capacity concurrency race as a first-class test; admin placeholder-vs-guest registration paths and their differing token behavior; cancel-with-mixed-registrant-types producing the correct notified/manual-contact split; reschedule preserving the roster; duplicate requiring and applying new times; the two new conflicts-view categories exercised end-to-end (revoke an assigned RSO's flag, create a blackout over an existing event).
- **Manual verification checklist (human sign-off, required before this is "done"):**
  1. As admin, create a course event spanning two ranges with no RSO shift yet scheduled; confirm it's created successfully and shows up as uncovered in the conflicts view, not blocked outright.
  2. As a member, register for an event, then attempt to ad-hoc-book the same range during the event window; confirm it's rejected and names the event.
  3. As a guest (no login), self-register for a competition; receive the confirmation, follow the manage link, add a companion, then withdraw — all without an account.
  4. As admin, add a placeholder registrant with an email captured; confirm there is genuinely no way for that person to self-manage online (no email is sent granting any access).
  5. As admin, reschedule an event with existing registrants; confirm they receive a reschedule notice, not a cancellation notice, and remain registered.
  6. As admin, cancel an event with a mix of a member, a self-service guest, and a placeholder registrant; confirm the member/guest are emailed and the placeholder appears in a distinct "contact directly" list.
  7. As admin, duplicate an existing event to a new date; confirm the clone has zero registrations and the original event's roster is untouched.

---

## OUT OF SCOPE (for this spec)

- Guest Forms for event registrants — still blocked on real form content from the club, same as ad-hoc Guest Booking.
- Payment/fees for courses or competitions — out of scope globally per `../SCOPE.md`.
- Any automated recurring-series engine — `duplicate` remains the deliberate answer, per `../SCOPE.md`.
- Waitlisting a full event — not requested anywhere in `../SCOPE.md`; a full event simply rejects further registration attempts.
- A public-facing calendar/listing page beyond the authenticated registration flow — presentation is a frontend concern layered on top of this spec's API.

---

## Decisions made while writing this spec (flag if any don't match your intent)

1. **Event coverage is not a creation-time gate.** A literal reading of `../SCOPE.md`'s "an event still requires a covering RSO shift... same rule as ad-hoc bookings" could be read as blocking creation without coverage — I've deliberately not done that, since events are routinely scheduled weeks before shift rosters exist, and blocking on that would break normal course-scheduling workflow. Coverage is instead a live fact surfaced via the conflicts view.
2. **A `wholeClub` event requires `assignedRsoUserId` at creation** — a practical constraint not explicitly stated in `../SCOPE.md`, needed because there's no specific range list to check shift-coverage against for a club-wide event.
3. **Ad-hoc booking creation in both `04` and `05` is amended to also check `isClaimedByEvent`** — the second cross-spec amendment in this series, unavoidable given `../SCOPE.md`'s explicit mutual-exclusion decision.
4. **`PLACEHOLDER` registrants never get self-service access, even with a captured email** — preserves `../SCOPE.md`'s explicit three-way member/guest/placeholder distinction, deliberately *not* matching the simpler two-way (email-present-or-not) rule used for ad-hoc Guest Booking's admin-creation path, since events' own scope text draws that line explicitly and ad-hoc booking's didn't.
5. **Admin can add companions to a placeholder registration on the registrant's behalf** — reading "cannot bring guests of their own" as no *self-service* capability, not an absolute prohibition.
6. **Duplicate requires the new date/time in the same call**, rather than allowing a half-configured clone that "must be set before usable" — simpler, avoids an ambiguous intermediate state.
7. **Reschedule is just an edit (`PATCH` with new times), not a separate cancel-and-recreate** — preserves the roster and sends a distinct notification, since a schedule change isn't the same event-ending as a true cancellation.
