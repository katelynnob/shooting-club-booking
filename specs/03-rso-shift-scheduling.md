# Feature Spec: RSO Shift Scheduling

Parent: [../SCOPE.md](../SCOPE.md), scope items 6 & 7 ("RSO coverage", "Club policy settings"). Builds on the `isRso` flag and access-control guards from [01-accounts-and-ranges.md](01-accounts-and-ranges.md).

Status: DRAFT — pending your sign-off before any implementation starts.

"Done" for this feature means: this spec is agreed, automated tests below pass, and a human has walked through the manual verification checklist against the running app.

Stack: Next.js (TypeScript, App Router) + Prisma + Postgres, per the established stack.

---

## GOAL

Let RSOs declare which time windows on which ranges they're covering (and let admin do the same on their behalf), and provide the single, reusable **coverage-check function** that every later feature needing "is this slot actually safe to book" — ad-hoc Booking, Courses & Competitions, Guest Booking — will call. Nothing here builds those features; it only builds the ground truth they'll all depend on, the same layering role [01-accounts-and-ranges.md](01-accounts-and-ranges.md) played for identity and ranges.

---

## SCOPE

In scope:

1. `RsoShift` CRUD: RSOs manage their own shifts; admin manages any RSO's shifts.
2. `ClubSettings`: the RSO self-supervision toggle from `../SCOPE.md`, admin-configurable — **Super-Admin-only**, given the liability weight `../SCOPE.md` already put on this decision ("confirm with your insurer/governing body before ever switching it ON"). New restriction, flagged below.
3. The coverage-check service: given a range and a time window, is it covered by a qualified RSO — and, critically, is it covered *for a specific person* (accounting for the self-supervision toggle when that person is themselves the covering RSO).
4. New shared guard: `requireRso` (valid session, `status === APPROVED`, `isRso === true`).

Out of scope for this spec (deferred to specs built on top of this one): the actual "conflicts view" that surfaces bookings left uncovered after a shift changes — that requires a `Booking` model that doesn't exist yet. This spec guarantees the coverage-check function is correct and callable; the Booking spec is responsible for calling it and building the conflicts view on top. Also out of scope: ad-hoc slot booking, courses/competitions, guest booking themselves, and any admin override of the self-supervision rule at the level of an individual booking (that's a Booking-spec admin-override concern, not a shift-scheduling one).

---

## DATA MODEL (Prisma schema, illustrative)

```prisma
model RsoShift {
  id              String   @id @default(cuid())
  rangeId         String
  range           Range    @relation(fields: [rangeId], references: [id])
  rsoUserId       String              // whose shift this is
  rso             User     @relation("ShiftOwner", fields: [rsoUserId], references: [id])
  createdByUserId String              // who actually created the row — the RSO themselves, or an admin on their behalf
  createdBy       User     @relation("ShiftCreator", fields: [createdByUserId], references: [id])
  startTime       DateTime
  endTime         DateTime
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([rangeId, startTime, endTime])
  @@index([rsoUserId, startTime, endTime])
}

model ClubSettings {
  id                        String   @id @default("singleton") // enforce exactly one row at the application layer — always read/write this fixed ID
  rsoSelfSupervisionAllowed Boolean  @default(false)            // matches ../SCOPE.md's default: OFF
  updatedByUserId           String?                              // audit trail — who last flipped this, given its liability weight
  updatedAt                 DateTime @updatedAt
}
```

No changes to `User` or `Range` from [01-accounts-and-ranges.md](01-accounts-and-ranges.md) beyond the two new relations shown above.

---

## BEHAVIOUR

### RSO's own shifts
- `GET /api/rso/shifts?from=&to=` — `requireRso`. Lists the calling RSO's own shifts (past and future) in the given range, defaulting to upcoming only if unspecified.
- `POST /api/rso/shifts` — `requireRso`. Body: `rangeId`, `startTime`, `endTime`. Creates a shift with `rsoUserId = createdByUserId = self`.
- `PATCH /api/rso/shifts/:id` — `requireRso`, and only if the shift's `rsoUserId` is the caller. Rejected once `endTime` is in the past — a shift that has already fully elapsed becomes an immutable historical record for a regular RSO (admin can still correct it, see below).
- `DELETE /api/rso/shifts/:id` — same ownership and not-yet-ended rule as `PATCH`.

### Admin management of any RSO's shifts
- `GET /api/admin/rso-shifts?rangeId=&rsoUserId=&from=&to=` — `requireAdmin`. Filterable list across all RSOs/ranges.
- `POST /api/admin/rso-shifts` — `requireAdmin`. Body: `rangeId`, `rsoUserId`, `startTime`, `endTime` — creates a shift on behalf of any RSO (`createdByUserId` = the admin, `rsoUserId` = the named RSO).
- `PATCH /api/admin/rso-shifts/:id` / `DELETE /api/admin/rso-shifts/:id` — `requireAdmin`, **no time restriction** (unlike the RSO self-service routes) — admin can correct even an already-elapsed historical shift record, consistent with admin's general override authority elsewhere in this system.

### Validation shared by both creation paths
- `startTime` must be strictly before `endTime`.
- `startTime` must not be in the past at creation time (no backfilling history through the create endpoint).
- The target `range` must not be archived.
- The assigned `rsoUserId` must, at the moment of creation/edit, have `isRso === true` and `status === APPROVED` — you cannot schedule someone who isn't currently a qualified, active RSO.
- **No two shifts for the same RSO may overlap, on any range.** One person can't cover two ranges — or even the same range twice — at the same time. This check runs across the RSO's *entire* schedule, not just within one range.

### Club settings (self-supervision toggle)
- `GET /api/admin/settings` — `requireAdmin` (any admin can view the current setting).
- `PATCH /api/admin/settings` — body `{ rsoSelfSupervisionAllowed: boolean }` — gated by **`requireSuperAdmin`**, not `requireAdmin`. This is a new, stricter restriction than a typical admin setting: given `../SCOPE.md`'s explicit warning to confirm this with the club's insurer/governing body before enabling it, a regular admin shouldn't be able to flip it unilaterally. Records `updatedByUserId` on every change.

### Coverage-check service (the reusable core of this spec)
Two functions, not HTTP endpoints — internal services that later specs' route handlers call directly:

- **`getCoveringRsoIds(rangeId, startTime, endTime): string[]`** — returns the `rsoUserId`s of every shift that (a) belongs to that range, (b) has `isRso === true` checked **live** (not cached from shift-creation time — see Edge Cases), and (c) **fully contains** `[startTime, endTime)` within a single shift row. Two adjacent shifts that together span the window but individually don't (e.g. Shift A ends exactly when Shift B begins) do **not** count — a slot must be coverable by one identifiable responsible RSO, not stitched together across a handover boundary. Empty array = not covered at all, regardless of who's asking.
- **`isCoveredForBooker(rangeId, startTime, endTime, bookerUserId | null): boolean`** — the actual check a booking attempt runs:
  - Compute `coveringRsoIds` via the function above. If empty, not covered — return `false` regardless of anything else.
  - If `bookerUserId` is `null` (a guest, or a member who isn't themselves an RSO) or not present in `coveringRsoIds`: covered — return `true`.
  - If `bookerUserId` **is** present in `coveringRsoIds` (the booker is one of the covering RSOs, trying to book their own slot): check `ClubSettings.rsoSelfSupervisionAllowed`, read fresh at call time (not cached):
    - `true` → covered, return `true`.
    - `false` → covered only if `coveringRsoIds` contains at least one *other* ID besides `bookerUserId` — i.e. a second RSO also covers this exact window.

---

## EDGE CASES

| # | Scenario | Expected behaviour |
|---|---|---|
| 1 | RSO has a shift on Rifle 100m, 10:00–12:00, and tries to create a second shift on Pistol 25m, 11:00–13:00 | Rejected — one person can't cover two ranges at once. Overlap is checked across the RSO's entire schedule, not per-range. |
| 2 | RSO tries to create two overlapping shifts on the *same* range | Rejected, same overlap rule — always a data-entry error, never a valid state. |
| 3 | Shift A (RSO 1, 9:00–11:00) and Shift B (RSO 2, 11:00–13:00) exist back-to-back on the same range; a 10:30–11:30 slot is checked | **Not covered** — no single shift fully contains it, even though the two shifts together span the whole window. A slot needs one identifiable responsible RSO for its entire duration. |
| 4 | Admin tries to create a shift assigning someone whose `isRso` is currently `false` (or who is `PENDING`/`DEACTIVATED`) | Rejected with a field-specific validation error at creation time. |
| 5 | An RSO's `isRso` flag is later revoked by admin while they have existing future shifts still on the calendar | Their shift rows are **not** deleted, but stop counting as coverage immediately — `getCoveringRsoIds` re-checks `isRso` live on every call, never trusting a cached value from when the shift was created. Any slot that now lacks coverage as a result is a real gap; surfacing it to admin is the (future) Booking spec's conflicts view, not something this spec can show yet since no bookings exist. |
| 6 | RSO tries to edit or delete their own shift after it has already ended | Rejected via the self-service routes — a fully-elapsed shift is an immutable historical record for the RSO. Admin can still correct it via the admin routes, which have no such restriction. |
| 7 | RSO tries to edit or delete a *different* RSO's shift via `/api/rso/shifts/:id` | Rejected — the RSO-scoped routes are ownership-checked; only admin can act on someone else's shift. |
| 8 | Admin edits/deletes a shift that (once Booking exists) has bookings depending on it | Not this spec's concern to detect — per the established "no silent auto-cancel" pattern in `../SCOPE.md`, shifts can always be freely edited/deleted here; it's the future Booking spec's job to recompute coverage and surface anything now-uncovered, using the coverage-check functions defined here. |
| 9 | Self-supervision toggle OFF (default), exactly one shift covers a slot, and that shift's own RSO tries to book it | Rejected — `isCoveredForBooker` returns `false` since the only covering ID is the booker themselves and no second RSO exists for that window. |
| 10 | Self-supervision toggle OFF, but *two* different RSOs both have shifts fully covering the same slot, and RSO #1 tries to book | Allowed — RSO #2's shift independently satisfies coverage; the rule only excludes the booker's *own* shift from counting, not every RSO's. |
| 11 | The self-supervision toggle is flipped after some shifts/bookings already exist | Every check reads the current value live at the moment of the booking attempt — never cached. Consistent with `../SCOPE.md`'s existing decision that a toggle flip is never retroactive to bookings already made, only to new attempts going forward. |
| 12 | A regular Admin (not Super Admin) tries to change the self-supervision toggle | 403 from `requireSuperAdmin` — same pattern as `set-admin` in [01-accounts-and-ranges.md](01-accounts-and-ranges.md). |
| 13 | Admin or RSO tries to create a shift on an archived range | Rejected — no point scheduling coverage for a range that's not bookable anyway. |
| 14 | A shift is created with `startTime` in the past | Rejected — this endpoint is for scheduling, not backfilling history. |
| 15 | A shift's `startTime` is not strictly before its `endTime` (equal, or reversed) | Rejected as an invalid time range. |

---

## ACCEPTANCE CRITERIA

1. Creating a shift that overlaps any of the same RSO's existing shifts — on the same range or a different one — is rejected.
2. Creating a shift for a user without a current `isRso === true` (or not `APPROVED`) is rejected with a field-specific error.
3. `getCoveringRsoIds` never returns an ID for a shift whose owner's `isRso` has since been revoked, even though the shift row itself still exists — verified by revoking the flag after shift creation and re-checking coverage.
4. A slot only counts as covered if a single shift fully contains it — verified with two adjacent, non-overlapping shifts that together span the slot but individually don't, confirming coverage is `false`.
5. `isCoveredForBooker` returns `false` when the sole covering RSO is the booker themselves and the toggle is off; returns `true` the moment a second covering RSO exists for that same window, all else equal.
6. `isCoveredForBooker` returns `true` for the booker-is-the-sole-RSO case once the toggle is on, without needing a second RSO.
7. Flipping `ClubSettings.rsoSelfSupervisionAllowed` is rejected for a regular Admin and succeeds for the Super Admin, verified directly against the API.
8. An RSO cannot edit or delete their own already-ended shift; admin can, verified directly against both route sets.
9. An RSO cannot edit or delete another RSO's shift via the RSO-scoped routes.
10. Creating a shift on an archived range, with a past `startTime`, or with `startTime >= endTime` is rejected in each case with a specific validation error, not a generic failure.
11. `ClubSettings` always has exactly one row in the database, and every read/write in the codebase goes through the fixed `"singleton"` ID rather than querying for "the first row."

---

## TEST PLAN

- **Unit:** `getCoveringRsoIds` and `isCoveredForBooker` against a range of hand-constructed shift/toggle scenarios (no coverage, exact-fit coverage, adjacent-but-not-overlapping shifts, self-supervision on/off with one or two covering RSOs), overlap-detection logic in isolation.
- **Integration (API route handlers against a real test Postgres instance):** full shift CRUD for both the RSO-scoped and admin-scoped routes, including ownership and time-based rejections; `isRso`-revocation-affects-coverage scenario end-to-end; settings toggle gated correctly by `requireSuperAdmin` vs `requireAdmin`.
- **Manual verification checklist (human sign-off, required before this is "done"):**
  1. As an RSO, create a shift on a range; confirm it appears in your own shift list. Attempt to create an overlapping shift on a different range; confirm it's rejected.
  2. As admin, create a shift on behalf of a different RSO; confirm it shows up correctly attributed (whose shift vs. who created it).
  3. As the RSO who owns a shift that has already ended, attempt to edit it through the UI; confirm it's blocked, then confirm admin *can* edit the same shift.
  4. As a regular Admin, attempt to toggle self-supervision; confirm it's blocked. As the Super Admin, confirm the toggle succeeds and is reflected immediately.
  5. Manually exercise the coverage-check scenario end-to-end once you have a way to trigger it (likely once the Booking spec's UI exists) — a slot with no RSO shift, one shift covering it, and the self-supervision on/off cases should all behave as specified above.

---

## OUT OF SCOPE (for this spec)

- The admin "conflicts view" showing bookings that lost coverage after a shift changed — requires the `Booking` model from a spec that doesn't exist yet; deferred there, built on top of `getCoveringRsoIds`/`isCoveredForBooker` defined here.
- Ad-hoc slot booking, Courses & Competitions, Guest Booking — all future specs, all consumers of the coverage-check service defined here.
- Any per-booking admin override of the self-supervision rule (e.g. "let this one booking through anyway") — that's a Booking-spec admin-override concern, not something modeled into shift scheduling itself.
- Any interaction with Blackout windows (a future spec) — a shift scheduled over a blackout is simply inert (no bookings possible there regardless), not an error condition worth validating against here.
- UI/calendar visualization of shift schedules — this spec is the API/data layer; presentation is a frontend concern layered on top.

---

## Decisions made while writing this spec (flag if any don't match your intent)

1. **Self-supervision toggle is Super-Admin-only, not regular-Admin.** New restriction beyond what `../SCOPE.md` explicitly stated — justified by the same liability weight that document already assigns to this setting. Easy to loosen to `requireAdmin` if that's overkill for how your club actually delegates admin trust.
2. **A slot must be covered by one single shift end-to-end — no stitching adjacent shifts together across a handover.** This wasn't explicitly decided anywhere before; it's the safer, less ambiguous interpretation of "falls entirely within a scheduled RSO shift" from `../SCOPE.md`.
3. **RSO coverage is always re-verified live against current `isRso` status, never cached from shift-creation time.** Also not explicitly decided before — the safer choice for a safety-critical check.
4. **RSOs can't edit/delete their own already-ended shifts; admins can, with no time restriction.** A reasonable extension of the existing "admin can override" pattern, not previously stated this specifically.
5. **A single RSO's shifts can never overlap, even across different ranges.** Physical reality (one person, one place) — not explicitly stated before but hard to imagine you'd want otherwise.
