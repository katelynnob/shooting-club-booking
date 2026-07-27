# Shooting Club Booking

A self-service range-booking platform for Harbour House Sports Club
(Co. Kildare, Ireland). Members and guests book time slots across
6 discipline-specific ranges, subject to capacity, Range Safety
Officer (RSO) coverage, and admin-set blackout windows. Also handles
scheduled courses/competitions.

## Status

Actively in development. See [SCOPE.md](SCOPE.md) for the full v1
scope and [GETTING_STARTED.md](GETTING_STARTED.md) for the build
order. [specs/](specs/) holds the detailed per-feature specs.

## Stack

Next.js (TypeScript, App Router) + Prisma + Postgres + Auth.js,
running via Docker Compose. See SCOPE.md's "Reasoning" sections for
why each piece was chosen.

## Running locally

    docker compose up -d --wait
    cd app
    npm install
    npm run dev
