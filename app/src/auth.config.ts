import type { NextAuthConfig } from "next-auth";

/**
 * Shared, adapter-free config. Split out from auth.ts per Auth.js v5's
 * recommended pattern — kept separate so it can be imported anywhere (e.g. a
 * future proxy.ts route guard) without pulling in the Prisma-touching
 * Credentials `authorize()` logic, which lives only in auth.ts.
 */
export default {
  session: {
    // JWT, not database sessions — see specs/01-accounts-and-ranges.md's
    // "Session strategy" section for why (Credentials + Auth.js's database
    // strategy don't reliably work together; sessionVersion is the
    // revocation mechanism instead, checked in the `session` callback).
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [], // populated in auth.ts, which needs Prisma for authorize()
} satisfies NextAuthConfig;
