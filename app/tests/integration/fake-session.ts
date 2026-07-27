import type { Session } from "next-auth";

// Shared by every route-handler integration test that needs to simulate
// "logged in as X" without going through Auth.js's actual request-scoped
// signIn()/cookie machinery (which requires a real running Next.js server —
// see the top-of-file note in admin-members.integration.test.ts for why).
// All the real business logic (DB reads/writes, status transitions, unique
// constraints) still runs for real against the test database; only "is
// there a valid session" is simulated.
export function fakeSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: {
      id: "test-user-id",
      status: "APPROVED",
      isRso: false,
      isAdmin: false,
      isSuperAdmin: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as Session;
}
