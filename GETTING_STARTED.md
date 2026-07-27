# Getting Started

This is the practical kickoff checklist — what to actually do, in order, once you're ready to move from spec to code. Parent: [SCOPE.md](SCOPE.md) and [specs/](specs/).

---

## Confirmed tooling decisions

These were assumed by the specs but not pinned down until now:

- **Unit tests:** Vitest.
- **Integration tests (the concurrency tests especially require a real Postgres, not a mock):** a second Postgres service in `docker-compose.yml` dedicated to tests, spun up alongside the dev database.
- **CI:** GitHub Actions from day one — lint + unit + integration on every push/PR, so regressions get caught as each feature spec gets implemented, not discovered later.

---

## Before writing any code

### External accounts/access (real-world, not code)
- [ ] Confirm the club's answer on Hetzner hosting (still "provisionally decided, pending confirmation" per [SCOPE.md](SCOPE.md)) — worth checking in on before investing time in deployment config, though local development doesn't depend on this at all.
- [ ] Create a [Resend](https://resend.com) account and get an API key (free tier).
- [ ] Decide the Super Admin's email address (yours, most likely) — needed for the bootstrap seed in [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md).
- [ ] Note: `harbourhouse.ie` DNS/SPF/DKIM setup doesn't block development — it's a pre-launch item, not a day-one one.

### Local environment
- [x] Node.js, Docker (via Colima — see below), git. Node and Docker weren't present on this machine and were installed via Homebrew as part of getting started.
- [x] Repo layout decided: a single Next.js app (`app/`) is sufficient for this project's size — no monorepo/separate frontend-backend split.

---

## The actual first steps, in order

1. ✅ **Scaffold the Next.js project** (TypeScript, App Router) inside this repo, alongside `SCOPE.md`/`specs/`. Done — see `app/`. Node.js and Docker (via Colima, a CLI-only runtime — no Docker Desktop GUI needed) were installed as part of this since neither was present on the machine.
2. ✅ **`docker-compose.yml`** with two Postgres services: `db` (dev) and `db_test` (integration tests, `tmpfs`-backed so it's always a clean slate). Done — both verified reachable with real queries.
3. ✅ **Prisma init**, `User`/`AccountToken`/`Range`/`RangeOperatingHours` from [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md). First migration applied to both `db` and `db_test`, smoke-tested with a real create/count/delete.
   - **⚠️ Version-specific finding, worth knowing before writing any other Prisma-touching code:** this project resolved **Prisma 7**, a materially newer major version than typical training-data knowledge covers. Its default generator (`prisma-client`, not the old `prisma-client-js`) outputs TypeScript directly to `src/generated/prisma` (gitignored, regenerated via a `postinstall` script) rather than into `node_modules/@prisma/client`. More importantly: **`new PrismaClient()` with no arguments now throws** — this version requires an explicit driver adapter (`@prisma/adapter-pg` for Postgres), constructed as `new PrismaClient({ adapter: new PrismaPg({ connectionString: ... }) })`. See `app/src/lib/db.ts` for the singleton that does this correctly — import `db` from there, never construct `PrismaClient` directly elsewhere.
4. ✅ **Auth.js v5 setup, with a real correction to the original plan.** The spec originally called for NextAuth database-backed sessions. Turns out **Auth.js v5's Credentials provider does not reliably support database sessions at all** — a structural library limitation (documented across multiple long-running upstream GitHub issues, not a config mistake), since the adapter's session-creation flow assumes an OAuth callback handshake a Credentials sign-in never goes through. **Fix: JWT sessions + a `User.sessionVersion` counter**, checked on every request via the `session`/`jwt` callbacks, incremented on deactivate/reactivate/password-reset — same immediate-revocation guarantee, different mechanism. [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md) has been updated to match (see its "Session strategy" section and the amendment note in Data Model). **Consequence:** no Auth.js adapter, no `Account`/`Session`/`VerificationToken` tables — they were added during scaffolding, then removed once it was clear the adapter itself wasn't needed for a Credentials-only, no-OAuth system.
   - Verified end-to-end in a real browser: correct login → dashboard; wrong password → "Incorrect email or password"; a simulated deactivation (bumping `sessionVersion` directly in the DB) while a session was still live in the browser correctly kicked that session out on its *very next request*, with the exact same cookie still attached — the core guarantee this whole mechanism exists for, actually proven, not just typed at.
   - **Gotcha worth knowing:** when throwing a custom `CredentialsSignin` subclass from `authorize()` to surface a specific error message, check `error.code` in the catch block, **not** `error.type` — `type` is always the fixed string `"CredentialsSignin"` for the whole error family; `code` is the field you actually set per-subclass. See `src/auth.ts`/`src/app/login/actions.ts`.
   - See `src/auth.config.ts` (shared, adapter-free config) / `src/auth.ts` (adds the Credentials provider + callbacks) — the recommended v5 split. Env vars use the `AUTH_` prefix, not the old `NEXTAUTH_` one, already reflected in `.env`/`.env.example`.
   - A throwaway dev seed (`prisma/seed.ts`, run via `npx tsx prisma/seed.ts`) creates one `APPROVED` test member directly — **not** the actual Super Admin bootstrap script or the real registration/invite flow, both still to be built as part of step 6.
5. ✅ **GitHub Actions workflow**: checkout → install → spin up `db_test` via Docker Compose → `prisma migrate` against it → lint → Vitest (unit) → integration tests. See `.github/workflows/ci.yml` — note it lives at the **actual git repo root**, not inside `shooting-club-booking/`, since that's a requirement of GitHub Actions, not a choice; the workflow's triggers are path-scoped to `shooting-club-booking/**` so it won't fire on unrelated changes elsewhere in this sandbox repo, and its steps default to `working-directory: shooting-club-booking/app`.
   - Vitest itself wasn't set up before this step — added here, along with two real test suites (not placeholders): a unit test for the login credentials validation schema (extracted from `src/auth.ts` into `src/lib/validation/credentials.ts` so it's actually testable in isolation), and an integration test suite (`tests/integration/`) formalizing the manual Prisma smoke test from step 3 into a repeatable one, using a dedicated `TEST_DATABASE_URL`-only client (`tests/integration/test-db.ts`) that's deliberately separate from `src/lib/db.ts`'s dev-database singleton, so integration tests can never accidentally touch dev data.
   - **Verified, not just written:** the entire pipeline was run locally in the exact CI sequence — `docker compose down -v` (simulating a genuinely fresh environment) → `docker compose up -d --wait db_test` → `prisma migrate deploy` against it → lint → unit tests → integration tests — all passing, before the workflow file was considered done. This repo has no GitHub remote configured yet, so the workflow can't actually run in GitHub until it's pushed somewhere; this local dry-run is the closest available substitute.
   - Two commands, one unit test script: `npm run test` (unit, no Docker needed) and `npm run test:integration` (needs `db_test` up and `TEST_DATABASE_URL` set — already in `.env` for local dev).
6. **Implement [specs/01-accounts-and-ranges.md](specs/01-accounts-and-ranges.md) end to end** — every endpoint, every edge case, every acceptance criterion as an actual test. This is the first real feature; nothing else can start until it's done, since every later spec depends on its accounts/ranges/guards. The trivial login page/dashboard built in step 4 are a proof of concept, not the real UI — expect to replace them with the actual registration/approval/invite/reset flows.
7. **Human sign-off**: walk the spec's own manual verification checklist against the running app before calling it done — that's the third leg of your own "spec + tests + human verifies" definition of done, and it's not optional just because the automated tests pass.
8. Move to [specs/02-email-notifications.md](specs/02-email-notifications.md), then 03 → 04 → 05 → 06, in that order — each one's dependencies are already built by the time you reach it.

---

## A note on pace

Six specs, each with 15-30 edge cases and acceptance criteria, is a lot of surface area. Don't try to build a whole spec in one sitting — the acceptance criteria list in each doc is designed to double as a per-feature checklist you can work through incrementally (register → login → approve → reject → deactivate → ranges → ...), checking items off as their tests pass and you've verified them manually, rather than treating the spec as one monolithic unit of work.
