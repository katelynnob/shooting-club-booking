import type { Session } from "next-auth";
import { auth } from "@/auth";
import { HttpError } from "@/lib/http-error";

/**
 * Shared access-control guards — specs/01-accounts-and-ranges.md, "Access-control
 * guards (shared across all future specs)". Implemented once here; every later
 * feature spec (booking, RSO shifts, blackouts, events) reuses these rather
 * than re-implementing per route.
 *
 * Each throws HttpError (caught by toErrorResponse at the route boundary) and
 * returns the valid Session on success, so route handlers can do:
 *   const session = await requireAdmin();
 */

export async function requireAuth(): Promise<Session> {
  // src/auth.ts's jwt/session callbacks already perform the sessionVersion
  // revocation check on every request — by the time a session reaches here,
  // it's already been confirmed live against the DB (see specs/01, "Session
  // strategy"). A null session at this point just means "not logged in" or
  // "was logged in but has since been revoked" — both are a 401 either way.
  const session = await auth();
  if (!session?.user) throw new HttpError(401, "Authentication required");
  return session;
}

export async function requireApprovedMember(): Promise<Session> {
  const session = await requireAuth();
  if (session.user.status !== "APPROVED") {
    throw new HttpError(403, "Account is not active");
  }
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await requireAuth();
  if (!session.user.isAdmin && !session.user.isSuperAdmin) {
    throw new HttpError(403, "Admin access required");
  }
  return session;
}

export async function requireSuperAdmin(): Promise<Session> {
  const session = await requireAuth();
  if (!session.user.isSuperAdmin) {
    throw new HttpError(403, "Super Admin access required");
  }
  return session;
}
