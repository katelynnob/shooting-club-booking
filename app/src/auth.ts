import NextAuth, { type Session, type User as NextAuthUser } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { JWT } from "next-auth/jwt";
import authConfig from "@/auth.config";
import { db } from "@/lib/db";
import { authorizeCredentials } from "@/lib/authorize-credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: NextAuthUser }) {
      if (user) {
        // Initial sign-in — `user` is exactly what authorize() returned above.
        token.id = user.id;
        token.status = user.status;
        token.isRso = user.isRso;
        token.isAdmin = user.isAdmin;
        token.isSuperAdmin = user.isSuperAdmin;
        token.sessionVersion = user.sessionVersion;
        return token;
      }

      // Every subsequent request: re-verify against the live DB row. This is
      // the sessionVersion revocation check — see specs/01-accounts-and-ranges.md,
      // "Session strategy". Returning null here is what makes deactivation,
      // reactivation, and password reset take effect on the very next request,
      // not just on token expiry.
      if (!token.id) return null;
      const dbUser = await db.user.findUnique({ where: { id: token.id } });
      if (!dbUser || dbUser.sessionVersion !== token.sessionVersion) {
        return null;
      }

      // Refresh role/status claims too, so an admin flag change or
      // deactivation is reflected immediately, not just at next login.
      token.status = dbUser.status;
      token.isRso = dbUser.isRso;
      token.isAdmin = dbUser.isAdmin;
      token.isSuperAdmin = dbUser.isSuperAdmin;
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (token.id) {
        session.user.id = token.id;
        session.user.status = token.status!;
        session.user.isRso = token.isRso!;
        session.user.isAdmin = token.isAdmin!;
        session.user.isSuperAdmin = token.isSuperAdmin!;
      }
      return session;
    },
  },
});
