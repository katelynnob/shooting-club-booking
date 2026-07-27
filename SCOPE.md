# Shooting Club Booking System — v1 Scope

Status: DRAFT — pending your sign-off before any implementation starts.

"Done" for every task below means: a written spec for that task + automated tests that pass + a human verifies it manually. No code is written against an item until it has that.

---

## Club context

Real details pulled from [harbourhouse.ie](https://harbourhouse.ie), the club's current website (a link to the booking system will be added there):

- **Club:** Harbour House Sports Club, Co. Kildare, Ireland (est. 1974)
- **Current opening hours:** Wed, Fri, Sat, Sun, 11am–4pm (v1 default schedule — admin-editable per range)
- **Ranges/disciplines:**
  - Rifle 100m
  - Rifle 50m Benchrest
  - Rifle 50m Gallery
  - Pistol 25m
  - Clay Pigeon
  - Archery (10m–90m)
- **Staff role today:** "Range Officers" — maps to the RSO role in this system
- **Existing programs:** scheduled beginner courses (fixed weekend dates) and a published competition calendar, both currently handled outside any booking system (phone/email, "book in advance if you wish")

---

## GOAL

Give club members **and non-member guests** a self-service way to reserve a discipline-specific range slot online, while giving staff/admins full visibility and override control, and ensuring every open slot has Range Safety Officer (RSO) coverage — all with member and booking data staying under the club's exclusive control, never processed by a third party's application or managed database service.

---

## SCOPE (v1)

In scope:

1. **Accounts & roles** — Member, RSO, Admin, Super Admin. Members self-register; admin approves (cross-checked manually against the club's membership records). **Admin can also create a member account directly**, skipping the approval step, with the new member invited by email to set their own password. RSO is a flag grantable by admin. Admin/Super Admin are supersets of RSO + member powers (see [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md) for the Super Admin distinction).
2. **Ranges** — A fixed, admin-managed set of 6 discipline-specific ranges (Rifle 100m, Rifle 50m Benchrest, Rifle 50m Gallery, Pistol 25m, Clay Pigeon, Archery), each with its own fixed capacity (number of concurrent shooters/lanes) and independent RSO coverage.
3. **Slots & booking** — Members browse available time slots per range and book/cancel, subject to capacity, RSO coverage, lead time, and cancellation cutoff rules.
4. **Booking cap** — A member may hold up to 5 active (future, non-cancelled) bookings at a time, across all ranges combined.
5. **Guest logging** — At booking time, a member can add guest names attending with them. Guests count toward the range's capacity.
6. **RSO coverage** — RSOs mark their own available shift windows; admin can also create/edit shift windows on an RSO's behalf. A range-slot can only be booked if it falls entirely within a scheduled RSO shift for that range.
7. **Club policy settings** — Admin-configurable club-wide policy toggles, starting with **RSO self-supervision** (see below).
8. **Blackout windows** — Admin can mark a range (or the whole club) unavailable for a date/time range (maintenance, private event). Existing bookings that fall inside a newly created blackout are surfaced to admin for manual resolution (not auto-cancelled).
9. **Courses & competitions** — A separate event/registration type (distinct from ad-hoc slot booking) for the club's scheduled beginner courses and competitions. Members view upcoming events and register/withdraw, subject to event capacity and a 48-hour withdrawal cutoff. **Guests can also self-register directly**, same as they can self-book an ad-hoc slot (see item 13). Admin can additionally add non-member placeholder registrants (name + contact only) for anyone who signed up by phone/email instead — a fallback path, not the only path, now that guests can self-serve. Admin can duplicate an event to quickly recreate recurring courses. Registering for an event on a range blocks ad-hoc slot booking on that range for its duration.
10. **Notifications (email only)** — Booking/registration confirmation, cancellation confirmation, and a reminder before the slot/event. No SMS in v1.
11. **Admin panel** — Approve/deactivate members, manage ranges & capacity, manage RSO shifts, view all bookings (member and guest), cancel/override any booking, create blackout windows, set club policy toggles, create/manage courses & competitions. (Guest form template management is deferred along with Guest Forms itself — see item 14.)
12. **Hosting/architecture** — A rented Hetzner VPS (recommendation below), running a self-managed Postgres instance — not a managed database service, not a third-party SaaS backend. No company's application code ever reads or writes club data; only Hetzner's (encrypted, access-controlled) hardware hosts it.
13. **Guest (non-member) booking** — A guest can book an ad-hoc slot or register for a course/competition entirely on their own, with no member sponsorship and no account/login: just contact details, subject to the exact same capacity, RSO-coverage, blackout, and lead-time/cutoff rules as members, in the **same shared capacity pool, first-come-first-served** (no reserved member-only allocation in v1). Identity is a lightweight, no-password model: a booking confirmation email contains a unique link the guest uses to view/cancel that one booking — valid until **1 hour after the booked slot/event ends** — there is no persistent guest account.
14. **Guest forms — deferred, not built in v1**, pending real form content from the club (can't be invented — see Open Questions). The Guest Booking data model is nonetheless designed to accommodate attaching form submissions to a booking later (an optional relation, not retrofitted), so this can be added without reworking guest booking itself once real content is available — same "build the hook now, the feature later" pattern used for per-range slot length in [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md).

**Hosting recommendation — PROCEEDING PROVISIONALLY, pending explicit club confirmation.** A single Hetzner Cloud VPS (their smallest/cheapest tier is plenty for a club this size) running the app + Postgres via Docker Compose, full-disk encryption enabled, a reverse proxy (e.g. Caddy) for automatic TLS, and a nightly encrypted backup shipped to a *second*, separate storage location (e.g. Hetzner Storage Box or Backblaze B2) so a single VPS loss doesn't mean total data loss.

**Status:** this has been raised with the club and a response is pending. Development is proceeding on this basis in the meantime, on the understanding that it's revisited if the club pushes back once they actually respond — "we're using security best practices" is a reasonable thing to lead with, but it answers a different question than the one they raised (whether data leaves the premises at all vs. how well it's protected once it has). Worth keeping the distinction sharp when that conversation actually happens, rather than letting "best practices" implicitly stand in for "still local."

**⚠️ What's actually changed from the original goal — keep this straight for that conversation:** the original goal said data would "never leave club-controlled storage." This revision does not do that. Member and booking data will live on a rented server in a Hetzner datacenter (Germany/Finland), not at the club. What it *does* preserve: no third-party company's software (no managed-DB provider, no SaaS booking platform) ever runs a query against your data as part of their product — you install and fully control the database yourself, same as if it were your own hardware, just not on your own premises. Disk encryption protects against someone physically stealing a drive from Hetzner's datacenter; it does not protect against Hetzner (as a company, or under legal process) accessing a running server they host.

**"Security best practices" worth actually implementing, concretely** (since that's the reassurance being offered): full-disk encryption at rest, TLS in transit (Caddy handles this), SSH key-only access with no password auth, a firewall allowing only 443/22, unattended OS security updates, Postgres bound to localhost/internal Docker network only (never exposed directly to the internet), secrets (DB password, session keys) kept out of source control, and regular tested restores of the backup — not just backups that have never been verified to actually restore.

**Reasoning for each piece of this:**
- **Hetzner VPS over a physical box at the club:** for a first project, self-hosting on-premises adds real operational burden that has nothing to do with building the app — the club's home/office internet has to stay up, you need port-forwarding or a tunnel, you need someone physically present to fix hardware issues, and power outages take the whole system down. A VPS removes all of that: it's professionally powered, professionally networked, and trivial to reach — at the cost of the data no longer being physically on club premises.
- **Self-managed Postgres, not a managed DB service (Neon/Supabase/RDS/etc.):** this is the piece that actually preserves the spirit of the original requirement. A managed database service means that company's software is the thing executing every query against your plaintext data — that's a materially different trust relationship than renting encrypted disk space and running your own database engine on it, where no one but you has application-level access to the data.
- **Docker Compose:** same reasoning as before — the club won't have a dedicated sysadmin, and "copy a folder, run one command" beats hand-reconstructing a Postgres install and app runtime from memory if the server ever needs to be rebuilt or migrated to a new VPS.
- **Postgres over SQLite:** unchanged reasoning — genuine booking concurrency (see Edge Case #1) needs real transactional locking, which is Postgres's well-trodden path.
- **Full-disk encryption:** protects the data at rest if a drive is ever decommissioned or physically compromised — cheap insurance, no reason not to enable it, but be clear-eyed that it's not the main privacy control here (self-managed Postgres is).
- **Reverse proxy (Caddy) for TLS:** keeps the app process from directly facing the internet, gets you automatic certificates, and can be reconfigured without touching app code.
- **Backup to a *second* location:** a VPS can be destroyed, and Hetzner itself is a single point of failure if your only backup lives on the same account/region. A second independent storage location (even a different provider) is the minimum real insurance against total data loss.

---

## BEHAVIOUR

### Accounts & roles
- Anyone can submit a registration request (name, email, password, **required** membership number — the cross-reference key admin uses to manually verify against the club's membership records).
- Registration is inert (no login) until an admin approves it.
- **Admin can alternatively create a member account directly**, bypassing the pending-approval step entirely (the admin creating it *is* the verification) — the new member gets an emailed invite link to set their own password, and is logged in immediately once they do. Useful for onboarding members admin has already verified some other way (e.g. in person, or while going through the membership sheet proactively) without making them separately self-register.
- Admin can approve, reject, or deactivate any account at any time.
- Deactivating a member does not delete their booking history; it prevents new bookings and cancels/flags their future ones for admin review.
- RSO role is a flag admin sets on an approved member account.
- **Non-members interact with the system only through the separate Guest booking path (below) — they never get a `User` account.** The account model above (Member/RSO/Admin/Super Admin, all requiring approval) stays exactly one kind of user; guests are a deliberately distinct, lighter-weight concept, not a new account status.

### Ranges & capacity
- v1 ships with 6 ranges pre-modeled on Harbour House's actual layout: Rifle 100m, Rifle 50m Benchrest, Rifle 50m Gallery, Pistol 25m, Clay Pigeon, Archery. Admin can still add/edit/archive ranges (not hardcoded), in case the layout changes.
- Each range: name, discipline, capacity (max concurrent people, counting members + their logged guests), own operating-hours schedule (default Wed/Fri/Sat/Sun 11am–4pm, editable per range).
- Archiving a range hides it from new bookings but preserves history.

### Slots & booking
- Slots are generated from a per-range operating schedule (admin-defined open hours per day of week) sliced into fixed-length blocks. **v1 default: 1-hour blocks.** The block length is a per-range data field (not hardcoded), so admin tooling to customize it per range can be added later without a data-model rewrite — the UI to *edit* it is not built in v1, it's just not architecturally blocked.
- A member can book a slot if, at booking time:
  - The slot is within the minimum lead time boundary (**≥ 2 hours** from now).
  - The range has remaining capacity for that slot (accounting for existing bookings + guests).
  - The slot is fully covered by a scheduled RSO shift for that range.
  - The slot is not inside a blackout window.
  - The member is active (approved, not deactivated).
  - The member has fewer than 5 active bookings.
- Cancellation is allowed up to **4 hours** before slot start. After that cutoff, the booking stands and is later marked as attended/no-show by staff.
- Cancelling frees the capacity immediately for others to book.
- **Intentional:** because the cancellation cutoff (4h) is longer than the minimum lead time (2h), a booking made 2–4 hours before its start is uncancellable from the moment it's created. This is by design — a booking made that close to the slot is treated as a firm commitment, not a placeholder. The UI must make this explicit at the point of booking (e.g. "this slot starts in 3 hours — once booked, you won't be able to cancel it"), so the member isn't surprised later.

### Guest logging (a member's own booking) vs. independent guest booking
Two distinct things now share the word "guest" — kept separate on purpose:
- **A member's logged guest** (unchanged from before): at booking time, a member can add/remove guest *names* attending with them under their own booking. These are name strings only, never independent records, never able to manage or cancel anything themselves.
- **An independent guest booking** (new, see below): a non-member books entirely on their own, with no member involved at all.
- Total occupants (member + their logged guests) cannot exceed remaining range capacity for that slot — same rule as always.

### Guest (non-member) booking — independent, no account
- A guest booking flow is public (no login) and separate from the member booking flow, but draws from the **exact same slot/capacity data** — a range's remaining capacity is shared between member bookings, members' logged guests, and independent guest bookings, first-come-first-served. There is no reserved member-only allocation in v1 (see `../SCOPE.md` decision above) — a popular slot filling entirely with guest bookings before a member gets to it is accepted as-is, not a bug.
- To book, a guest provides: name, email, phone — no password, no account created. (Guest Forms, once built, would add an optional pre-fill step here — see below — but they're deferred in v1, so booking today has no form requirement at all.)
- Subject to the **same rules as member bookings**: minimum lead time (2h), cancellation cutoff (4h) including the same "2–4h out means uncancellable" behavior, RSO coverage, blackout windows. A guest never has an `isRso` flag (obviously) and is unaffected by the self-supervision toggle.
- A guest can log their own companion names against their booking, same mechanic and same capacity constraint as a member's logged guests (see above) — e.g. one person booking on behalf of a small group of newcomers.
- **No concurrent-booking cap enforced in v1** (unlike the member's 5-booking cap) — there's no durable identity to enforce a cap against (an email address is trivially changeable). This is a deliberate v1 gap, not an oversight — see Edge Cases and the Pre-Launch Hardening Checklist for the abuse-prevention question this raises.
- **No admin approval/gatekeeping** — a guest booking is confirmed immediately on submission, exactly like a member's, subject only to the same automated checks (capacity/coverage/blackout/lead-time).
- **Identity/session model:** on successful booking, a confirmation email is sent containing a unique, unguessable link (a random token tied to that one booking). Following that link lets the guest view their booking and cancel it (subject to the same 4-hour cutoff) — no password, no persistent account, no access to any other booking past or future. The token is scoped to exactly one booking, and **expires 1 hour after that booking's slot/event end time** — after which the link simply no longer resolves to anything actionable (the booking itself is unaffected; only the guest's own after-the-fact access to it via that link ends).
- **Guest course/competition registration** works the same way — a guest can self-register for a course/competition event via the same token-link identity model, subject to the event's capacity and 48-hour withdrawal cutoff, same as a member registrant (see Courses & Competitions).
- Admin can always look up and manage any guest booking directly from the admin panel (by name/email/date) — the magic-link email is the guest's own access path, not the only way in if, e.g., an email bounces or is lost.

### Guest forms — DEFERRED, not built in v1
- **Not implemented in the first version** — the real content of the club's paper forms is needed before any form template can be built, and that content isn't available yet (see Open Questions). Building fictional form fields would be worse than not building the feature at all.
- **Designed for, though:** the guest booking data model reserves an optional relation from a guest booking to a future `FormSubmission` concept, so that once real form content arrives, this can be added as its own small spec without reworking guest booking itself. Concretely this means: guest booking's schema and API responses should not assume "no forms ever," even though no form UI, template model, or submission flow ships in v1.
- Once built, the intended shape (for reference, not yet a spec): admin defines **form templates** (name, field set — short text, long text, checkbox, date, single-choice; explicitly no signature-capture field type, since this stays a pre-fill/print tool, not an e-signature system) scoped to range(s)/booking types; a guest fills them in during or after booking, any time before arrival, never blocking the booking itself; a completed submission renders to a printable document for the front desk. The actual legal signature remains wet-ink, on paper, unchanged.
- **Follow-on once this ships:** revisit giving returning guests a real lightweight account so they can reuse previously-entered name/contact/form info instead of retyping it each visit — see Future Enhancements. Not relevant until there's actual form data worth reusing.

### RSO coverage
- RSO shifts are ranges of time tied to a specific range (a person covering "Rifle range, Sat 9am–1pm").
- RSOs can create/edit/delete their own future shifts.
- Admin can create/edit/delete any RSO's shifts.
- Editing/removing a shift that already has member bookings depending on it does not auto-cancel those bookings — it flags them for admin (see Edge Cases).
- **Self-supervision policy toggle:** a club-wide setting, admin-controlled, defaulting to **OFF** (conservative — matches what's actually documented for Irish clubs, where even provisional RSOs require another recognised RSO present; no clear rule confirms a recognised RSO can supervise themselves, so the safe default is "no").
  - **OFF (default):** an RSO's own scheduled shift does not count as coverage for a slot in which that same RSO is also booked as a shooter. A second RSO must be scheduled (or admin overrides) for that slot to be bookable by the RSO themselves.
  - **ON:** an RSO's own shift is sufficient coverage for their own booking, same as it would be for any other member's booking.
  - This is a single club-wide toggle in v1 (not per-range or per-RSO) — admin should confirm the rule with their insurer/governing body before switching it on.

### Blackout windows
- Admin defines a blackout: scope (one range or "all ranges"), start, end, reason (free text, for internal record).
- New bookings cannot be made inside a blackout.
- Existing bookings inside a newly created blackout are listed in an admin "conflicts" view; admin manually cancels/notifies as needed (system does not auto-cancel or auto-notify beyond that list).

### Courses & competitions
- Admin creates an **event** (course or competition): title, type, **one or more ranges (or "whole club")**, start/end date-time, capacity (number of participant seats, separate from the range's normal per-slot capacity), description. An event genuinely spans a list of ranges — e.g. a competition can claim both Rifle 100m and Pistol 25m at once — so this is a many-to-many relationship, not a single range field.
- Members see a list of upcoming events and can **register** or **withdraw**, subject to event capacity and the member being active/approved.
- **Guests can self-register directly**, same token-link identity model as guest slot booking (see Guest booking above) — this is now the primary path for a newcomer signing up for a beginner course, not just a phone call.
- **Admin-added placeholder registrants** remain available as a fallback: just a name + contact info, no login, no history beyond that one event, for anyone who still signs up by phone/email instead of using the self-service flow. A placeholder registrant counts against event capacity like anyone else but cannot log in, self-withdraw, or bring guests of their own.
- An event's range(s) are automatically blocked from ad-hoc slot booking for its duration — functionally like a blackout, but members register for the event itself instead of the range just being closed.
- Registering for an event does **not** count against the member's 5-active-booking cap (events are tracked separately from ad-hoc slot bookings).
- Guest logging for events: mirrors ad-hoc bookings — a registered *member or self-service guest registrant* can log companion names, capped by remaining event capacity. Placeholder registrants have no self-service access to do this themselves, but admin can still record companions on a placeholder's behalf.
- RSO/instructor coverage for events: admin can directly assign a specific RSO/instructor to an event as its designated coverage, which is the simplest path (especially for a whole-club event, where there's no single range to check shift coverage against). Absent a direct assignment, a scoped event's coverage is judged by whether its range(s) currently have RSO shift coverage for the full duration — but **this isn't a gate on creating or registering for the event**, since events are typically scheduled well before shift rosters exist that far out; it's a live fact admin can check via the conflicts view as the date approaches. The self-supervision toggle doesn't apply to events — there's no single "booker" to check against their own coverage the way there is for an individual ad-hoc booking.
- **Event withdrawal cutoff differs from ad-hoc bookings:** withdrawing from an event (member/guest-initiated) is allowed up to **48 hours** before the event start (default — tune as needed), reflecting that instructors/organizers need a firm headcount further in advance than a same-day range slot. Admin can still remove a registrant (including placeholder registrants) at any time, regardless of this cutoff.
- **Cancelling an entire event** releases every registration and notifies registrants with a known email (member and self-service guest); placeholder registrants (or the rare registrant with no email on file) are surfaced to admin as a "contact directly" list rather than notified automatically.
- **Rescheduling an event (a date/time change) is a distinct action from cancelling it** — the roster is preserved, not released, and registrants get a "this event has moved" notification rather than a cancellation notice.
- **Duplicate event:** admin can clone an existing event (course or competition) to a new date/time, copying all fields (ranges, capacity, description) as a starting point — a quick way to recreate the club's recurring beginner courses (e.g. the ~4x/year weekend courses) without a full recurrence engine.

### Notifications
- Email sent on: booking/event-registration confirmed, booking/event-registration cancelled (by member or by admin/system), an event being rescheduled (distinct from a cancellation notice), and reminders at **both 24 hours and 2 hours** before the slot/event start.
- Emails are best-effort; a failed send does not block or roll back the booking action itself.

### Admin panel
- Full CRUD on ranges, RSO shifts, blackout windows, courses & competitions. (Guest form template management is deferred along with Guest Forms itself — see above.)
- Member list with approve/reject/deactivate actions, plus directly inviting a new member (email + resend) without requiring self-registration first.
- Booking list (filter by range/date/member/guest) with cancel/override — includes both member and independent guest bookings in one view.
- Guest booking lookup (by name/email/date) with the ability to view/cancel/print forms directly, independent of whether the guest's own magic-link email arrived.
- Event roster view per course/competition (who's registered — member, guest, or placeholder registrant) with cancel/override and a "duplicate event" action.
- No analytics/reporting dashboard in v1 beyond simple lists (see Out of Scope).

---

## EDGE CASES

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | Two members try to book the last remaining capacity slot at the same instant | Exactly one succeeds; the other gets a clear "slot no longer available" error, not a silent overbook. Requires a DB-level constraint/transaction, not just app-level checking. |
| 2 | An RSO deletes/shrinks a shift that members already booked against | Existing bookings are NOT auto-cancelled. They're flagged in an admin conflicts view ("uncovered booking") for manual resolution. |
| 3 | Admin creates a blackout that overlaps existing bookings | Bookings are NOT auto-cancelled; they appear in the admin conflicts view. |
| 4 | Member tries to make a 6th active booking | Rejected with a clear message stating the cap and listing their current active bookings. |
| 5 | Member tries to cancel after the cancellation cutoff | Rejected; UI explains the booking now must be handled as a no-show by staff, not self-cancelled. |
| 6 | Member adds guests that would exceed remaining capacity | Rejected at the guest-add step; shows how many more the slot can hold. |
| 7 | Admin deactivates a member who has future bookings | Bookings flagged for admin review (not silently dropped); member can no longer log in or self-cancel. |
| 8 | RSO account is also later promoted to Admin, or demoted | Role change takes effect immediately; existing shifts/bookings they created are untouched. |
| 9 | Daylight Saving Time transition falls inside a recurring weekly schedule | Slot generation must be timezone-aware (store times in the club's local timezone with explicit UTC offset handling), not naive UTC math — otherwise a slot silently shifts by an hour twice a year. |
| 10 | Server/network outage while club is open | Members can't book remotely; no built-in offline fallback in v1 (see Out of Scope). Staff can still act as a manual fallback (phone/in person) — the system doesn't need to solve this, but it should fail with a clear error, not corrupt data. |
| 11 | Email provider is down or misconfigured | Booking/cancellation still succeeds; a failed notification is logged for admin, not surfaced as a booking failure to the member. |
| 12 | A guest is added without a member ever completing registration (e.g. non-member walk-in) | Guests are never full accounts — they're just a name string tied to a booking. No login, no waiver flag, no history beyond that one booking record. |
| 13 | An RSO tries to book a slot during their own (and only) scheduled shift, with the self-supervision toggle OFF | Rejected — that shift alone does not count as coverage for their own booking. UI explains a second RSO is needed, or admin must override. |
| 14 | An RSO tries to book a slot during their own shift, with the self-supervision toggle ON | Allowed — their own shift counts as valid coverage, same as for any other member. |
| 15 | Admin flips the self-supervision toggle while existing future bookings already rely on the old rule | Existing bookings are NOT retroactively cancelled or re-validated; the new rule only applies to bookings made after the toggle changes (avoids surprise cancellations from a policy change). |
| 16 | A member tries to make an ad-hoc slot booking on a range/time already claimed by a course or competition event | Rejected — the event's range/time is unavailable for ad-hoc booking, same as a blackout. UI should say it's reserved for the named event, not just "unavailable." |
| 17 | Admin creates an event on a range/time that already has ad-hoc member bookings | Existing ad-hoc bookings are NOT auto-cancelled; they're surfaced in the admin conflicts view, same treatment as a blackout. |
| 18 | An event fills to capacity | Further registration attempts are rejected with remaining-seats info, same UX pattern as a fully-booked ad-hoc slot. |
| 19 | Admin cancels an entire event with members/guests already registered | Registrants with a known email are notified; their registrations are released; companions logged against the event are dropped along with it. Placeholder/no-email registrants are surfaced to admin as a "contact directly" list, not silently skipped. |
| 19a | Admin reschedules an event (date/time change only, not a cancellation) | The roster is **not** released — registrants stay registered and instead receive a "this event has moved" notification, distinct from a cancellation email. |
| 20 | A member registers for an event, then separately tries to also ad-hoc book the same range during the event window | Rejected — same as case 16, from the member's own side this time (can't double-claim their own slot two ways). |
| 21 | A member books a slot 2–4 hours out (inside the "uncancellable" window) | Allowed to book, but the UI must warn before confirming that this booking cannot later be cancelled by the member. |
| 22 | Admin adds a placeholder (non-member) registrant to a course, then later that same person actually joins as a full member | These are treated as unrelated records in v1 — no automatic linking/merging of the placeholder registration to the new member account. Admin can note this manually if needed. |
| 23 | Admin tries to withdraw a placeholder registrant's spot vs. a member withdrawing their own | Admin can remove any registrant (placeholder or member) at any time; a member can only withdraw themselves, and only before the 48-hour cutoff. |
| 24 | Admin duplicates an event | Admin supplies the new date/time as part of the same duplicate action — the clone is created immediately usable, with an empty roster (no registrants carried over) and only the descriptive fields (ranges, capacity, title, description) copied. There's no intermediate half-configured state. |
| 25 | A guest booking and member bookings compete for the last unit of capacity in the same slot | Same first-come-first-served handling as case #1 — a guest's booking is not distinguished from a member's at the database/concurrency level. This is the deliberate consequence of the "same shared pool" decision, not a bug to fix later. |
| 26 | A guest loses/never receives their confirmation email (so never gets their magic link) | Admin can look up and manage the booking directly via the admin panel's guest lookup — the email link is the guest's own access path, not the system's only record of the booking. |
| 27 | A guest's magic-link token is used to try to view/cancel a *different* booking than the one it was issued for | Rejected — each token is scoped to exactly one booking at issuance; there is no way to enumerate or reach any other booking through it. |
| 28 | *(Forward-looking — Guest Forms is deferred, not built in v1)* A guest completes booking but never fills in the required form(s) before arriving | Not blocked by the system — forms are a convenience, not a hard gate. Staff fall back to the paper process on arrival exactly as today. Not testable until Guest Forms itself ships. |
| 29 | The same person books repeatedly under different email addresses (or the same one), with no account to rate-limit against | Not prevented in v1 — flagged as a deliberate gap, tracked in the Pre-Launch Hardening Checklist rather than solved now, since there's no durable guest identity to key a cap against without adding real friction (verification, accounts) that contradicts the "fully self-service, no gatekeeping" decision. |
| 30 | A guest self-registers for a course/competition, and separately an admin also adds them as a placeholder registrant for the same event (e.g. they called *and* used the online form) | No automatic dedup/merge — same treatment as Edge Case #22 (placeholder → member). Admin resolves duplicate entries manually by removing one from the roster. |

**Resolved (previously flagged for a decision):**
- Recurring/standing bookings: no automated recurring-series engine in v1; each course/competition occurrence is its own event, with a "duplicate event" shortcut to speed up re-creating repeat occurrences (see case #24).
- Guest-cancellation behavior: confirmed as designed — guests are simply dropped along with the booking/registration they're attached to, no separate guest-level cancellation flow (guests are never independent records).
- Event-specific lead-time/cutoff: confirmed different from ad-hoc bookings — events use a 48-hour withdrawal cutoff instead of the 4-hour ad-hoc cutoff.

---

## ACCEPTANCE CRITERIA

Each ships only when its own spec + tests exist and a human has verified it against these:

1. A member cannot see or book a slot that is outside RSO coverage, in a blackout, at/over capacity, or inside the lead-time window.
2. Two simultaneous booking attempts against the last unit of capacity never both succeed (verified with a concurrency test, not just manual clicking).
3. A member cannot exceed 5 concurrent active bookings; the 6th attempt is rejected with a specific, actionable error.
4. Cancelling a booking before the cutoff frees capacity immediately, verified by another member/admin seeing the slot become bookable again.
5. Cancelling after the cutoff is rejected, and the booking is visible to admin as a pending no-show determination.
6. Adding a guest that would exceed capacity is rejected; adding one that fits succeeds and is reflected in remaining-capacity counts everywhere it's shown.
7. Deleting/shrinking an RSO shift with dependent bookings does not delete or silently orphan those bookings — they appear in the admin conflicts view.
8. Creating a blackout with overlapping bookings surfaces those bookings in the admin conflicts view; no automatic cancellation occurs.
9. A rejected/pending member cannot log in and book; an approved member can.
10. All booking-relevant timestamps are correct across a DST transition (tested explicitly, not assumed).
11. The database is a self-managed Postgres instance under the club/developer's exclusive administrative control — verifiably not a managed database service (Neon/Supabase/RDS/etc.) and not queried by any third party's application code.
12. A failed outbound email never blocks or reverses a successful booking/cancellation.
13. With self-supervision OFF (the default), an RSO cannot book a slot covered only by their own shift; a second RSO's shift (or admin override) makes it bookable.
14. With self-supervision ON, an RSO can book a slot covered only by their own shift.
15. Toggling the self-supervision setting does not alter the validity of bookings already made under the previous setting.
16. A range/time claimed by a course or competition event cannot be ad-hoc booked by any member, and the rejection message names the event rather than giving a generic "unavailable."
17. Creating an event over existing ad-hoc bookings does not delete them; they appear in the admin conflicts view.
18. Event registration is rejected once the event reaches capacity, with a clear remaining-seats message.
19. Cancelling an event releases all registrations and drops associated companions; notified registrants are those with a known email, while placeholder/no-email registrants surface as a distinct "contact directly" list for admin.
19a. Rescheduling an event (changing its date/time without cancelling it) preserves every registration and sends a distinct "moved" notification instead of a cancellation email.
20. Event registrations never count against a member's 5-active-booking cap (verified by registering for an event at the cap and confirming it still succeeds).
21. Booking a slot inside the 2–4 hour uncancellable window shows an explicit warning before the member confirms; the booking still succeeds and is genuinely uncancellable afterward.
22. A placeholder (non-member) registrant can be added to an event roster by admin, counts against capacity, and cannot log in, self-withdraw, or add guests.
23. A member cannot withdraw from an event within 48 hours of its start; admin can remove any registrant (member or placeholder) at any time regardless of the cutoff.
24. Duplicating an event requires and applies the new date/time in the same action, copies descriptive fields only (no registrants), and the clone is immediately able to accept registrations — never a half-configured intermediate state.
25. A guest can book an available slot with no login and no member involvement, subject to the same capacity/RSO-coverage/blackout/lead-time rules as a member booking — verified end-to-end with no account created anywhere in the process.
26. A guest's magic-link token grants access to exactly one booking and no others, verified by attempting to use it against a different booking ID.
27. Admin can find, view, and cancel any guest booking from the admin panel using name/email/date, without needing the guest's own email link.
28. *(Forward-looking — not testable until Guest Forms ships)* A guest can complete required form(s) either during booking or afterward via their magic link, and an incomplete form never blocks or cancels the booking itself.
29. A guest can self-register for a course/competition through the same token-link flow, subject to the event's capacity and 48-hour withdrawal cutoff, exactly as a member registrant would be.
30. Guest bookings and member bookings are drawn from the identical capacity count for a given slot — a concurrency test (per Edge Case #25) confirms a guest and a member competing for the last unit of capacity resolves to exactly one winner, regardless of which one is the guest.

---

## OUT OF SCOPE (v1)

Explicitly not building, so nobody assumes it's included:

- Payment processing (fees, if any, are handled outside the system — cash/in-person).
- **Legal e-signature capture for waivers/liability forms.** Guest Forms (deferred but designed for, see above) would let a guest *pre-fill the same field content* ahead of arrival to save time at the desk, but the actual signature would remain wet-ink, on paper, in person — the system never captures or stores a legally-signing action, whenever that feature is eventually built. Don't conflate the two: digitizing form *data entry* is the eventual intent; digitizing the *legal signature* never is.
- SMS notifications (email only).
- Native mobile app (responsive web only).
- Integration with membership/dues management software.
- Firearm registration or licensing checks.
- Multi-club / multi-location support.
- Reporting/analytics dashboards beyond basic filterable lists.
- Recurring/standing bookings as an automated series (league nights, standing reservations) — each course/competition occurrence is created as its own one-off event instead; flagged above, revisit if needed.
- Offline/local fallback booking during a server or network outage.
- Public-facing "range status" page for non-members.
- Calendar sync (Google/Outlook/iCal export).
- Background checks or ID verification beyond admin's manual membership approval step.

---

## Open questions before implementation starts

All prior open questions are now resolved:

1. ~~Lead time / cancellation cutoff~~ — **Decided:** 2-hour minimum lead time, 4-hour cancellation cutoff, intentionally creating a firm "no cancellation" window for last-minute bookings (2–4h out). UI must warn about this at booking time.
2. ~~Slot block length~~ — **Decided:** 1-hour default, stored per-range so it can be made admin-configurable later without a rewrite.
3. ~~Reminder timing~~ — **Decided:** both 24h and 2h before.
4. ~~Hosting~~ — **Provisionally decided (Hetzner VPS + self-managed Postgres), pending explicit club confirmation.** Proceeding on this basis for now; revisit if the club responds with a hard "no" once they weigh in — reasoning recorded above.
5. ~~Recurring bookings~~ — **Decided:** no recurrence engine; "duplicate event" admin shortcut instead.
6. ~~Guest-cancellation behavior~~ — **Decided:** guests dropped silently with their booking/registration, no independent guest records.
7. ~~Event-specific lead time/cutoff~~ — **Decided:** 48-hour member withdrawal cutoff for events (vs. 4-hour for ad-hoc bookings); admin can override anytime.
8. ~~RSO self-supervision~~ — **Decided:** admin-configurable club-wide toggle, default OFF. Confirm with your insurer/governing body before ever switching it ON.
9. ~~Range list~~ — **Decided:** 6 ranges (Rifle 100m, Rifle 50m Benchrest, Rifle 50m Gallery, Pistol 25m, Clay Pigeon, Archery), each independently bookable/covered.
10. ~~Multi-range events~~ — **Decided:** an event can span one or more ranges (or the whole club).
11. ~~Newcomer registration~~ — **Superseded**, see #12–15 below: guests can now self-serve for both slots and courses/events; admin-added placeholder registrants remain only as a fallback for phone/email signups.
12. **Guest booking — Decided:** fully independent (no member sponsorship), lightweight magic-link identity (no account), fully self-service (no admin approval), same shared capacity pool as members (first-come-first-served, no reserved allocation).
13. ~~Guest forms~~ — **Decided:** deferred entirely from v1 (real form content not yet available and can't be invented), but the Guest Booking data model is built to accommodate it later without rework. Revisit once the club can supply the actual paper-form content.
14. **Guest booking abuse prevention — deferred**, tracked in the Pre-Launch Hardening Checklist above, needs a decision (rate limiting, CAPTCHA, soft per-email cap, or some combination) before real launch.
15. ~~Magic-link token specifics~~ — **Decided:** valid until 1 hour after the booked slot/event ends.

No open questions remain blocking a first technical spec, aside from item #14 above (guest booking abuse prevention), which is a pre-launch hardening concern.

**All v1 features now have a detailed technical spec, in dependency order:**
1. [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md) — accounts, roles, ranges
2. [specs/02-email-notifications.md](specs/02-email-notifications.md) — the shared email-sending mechanism
3. [specs/03-rso-shift-scheduling.md](specs/03-rso-shift-scheduling.md) — RSO shifts, self-supervision toggle, coverage-check service
4. [specs/04-slots-booking-and-blackouts.md](specs/04-slots-booking-and-blackouts.md) — ad-hoc slot booking, blackout windows, the admin conflicts view
5. [specs/05-guest-booking.md](specs/05-guest-booking.md) — non-member self-service booking
6. [specs/06-courses-and-competitions.md](specs/06-courses-and-competitions.md) — events, registration, the event/ad-hoc mutual-exclusion rule

Next step is either a final review pass across all six specs before writing any code, or picking one to start implementing first (Accounts & Ranges is the natural starting point, since everything else depends on it). See [GETTING_STARTED.md](GETTING_STARTED.md) for the concrete kickoff checklist (tooling decisions, external prerequisites, first steps in order).

---

## Pre-Launch Hardening Checklist

Things deliberately deferred during feature specs — not forgotten, not silently dropped. **Must be explicitly resurfaced and resolved before the system goes live to real members**, not left to be remembered later:

- **Rate limiting / brute-force protection** on all public-facing auth endpoints (registration, login, forgot-password) — deferred during [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md) to keep that spec focused; this is a public, internet-facing endpoint for a membership organization and needs this before real launch.
- **Guest booking abuse prevention.** Guest booking is fully self-service with no account, no admin gatekeeping, and no concurrent-booking cap (Edge Case #29) — nothing currently stops the same person from repeatedly booking/no-showing under different email addresses, or a bad actor from scripting bulk bookings to grief the shared capacity pool. Needs a real decision (rate limiting per IP/email, a CAPTCHA on the guest booking form, a soft cap like "max 1 upcoming guest booking per email," or some combination) before real launch — deferred to keep the guest-booking feature spec focused, not forgotten.
- **Rate limiting on the public slot-listing endpoint** (`GET /api/ranges/:id/slots`) — flagged during [specs/04-slots-booking-and-blackouts.md](specs/04-slots-booking-and-blackouts.md) as lower priority than the auth/guest-booking rate limiting above, but still worth deciding before real launch since it's a public, unauthenticated, potentially scrapable endpoint.
- (Add further items here as later feature specs defer their own hardening concerns, so this list stays the single place to check before go-live.)

---

## Future Enhancements (not v1, tracked so they aren't lost)

Real ideas raised during scoping that were deliberately deferred rather than built now — revisit if they turn out to matter once the club is actually using the system:

- **Ongoing membership/dues expiry enforcement.** v1 treats membership approval as a one-time gate — once approved, a member stays approved until an admin manually notices and deactivates them, even if they stop paying dues. A `membershipExpiresAt` field (admin-set at approval/renewal) that `requireApprovedMember` checks on every login would automate this, but isn't built for v1. See [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md) for the full tradeoff. Revisit if lapsed dues turn out to be a recurring admin headache in practice.
- **Guest accounts, once Guest Forms exist.** v1 guests are deliberately account-less (magic-link token per booking, no persistent identity — see Guest (non-member) booking above). Once Guest Forms is actually built (still blocked on getting real form content from the club — see that section's Open Question), it's worth revisiting whether a returning guest should be able to create a real lightweight account so they can reuse their previously-entered name/contact/form info instead of retyping it every visit. Not needed while there are no forms to reuse data from — this is specifically a Guest Forms follow-on, not a standalone guest-account feature to build sooner.
- **A queue/worker system for email retries.** [specs/02-email-notifications.md](specs/02-email-notifications.md) ships with a single immediate retry on transient failure and nothing beyond that (no Redis/BullMQ). Revisit only if `EmailLog` shows delivery reliability is actually a recurring problem in practice — not a preemptive build.
