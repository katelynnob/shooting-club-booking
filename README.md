# Shooting Club Booking

A self-service range-booking platform for Harbour House Sports Club
(Co. Kildare, Ireland). Members and guests book time slots across
6 discipline-specific ranges, subject to capacity, Range Safety
Officer (RSO) coverage, and admin-set blackout windows. Also handles
scheduled courses/competitions.

## Status

Actively in development. [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md) —
accounts, approval/invite flows, admin member management, and range
CRUD — is fully implemented, tested (51 unit + 99 integration tests),
manually verified end to end, and retrofitted onto the project's
design system. Specs 02–06 (email notifications, booking, blackouts,
courses/competitions) are not started yet.

See [SCOPE.md](SCOPE.md) for the full v1 scope, [GETTING_STARTED.md](GETTING_STARTED.md)
for the build order and what's done so far, [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)
for the UI's design system (tokens, ported component library, which
screens already use it), and [specs/](specs/) for the detailed
per-feature specs.

## Stack

Next.js (TypeScript, App Router) + Prisma + Postgres + Auth.js,
running via Docker Compose. See SCOPE.md's "Reasoning" sections for
why each piece was chosen. UI is built from a ported design system
(tokens + component library) — see [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).

## Running locally

    docker compose up -d --wait
    cd app
    npm install
    npm run dev
