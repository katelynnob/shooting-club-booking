// Imported from @auth/core directly (not the top-level "next-auth" package)
// — that package's main entry transitively pulls in next/server, which
// fails to resolve when this module is loaded outside an actual Next.js
// runtime (e.g. directly under Vitest for integration tests). @auth/core is
// framework-agnostic by design and has no such dependency. next-auth
// re-exports the identical class, so this is the same error type either way.
import { CredentialsSignin } from "@auth/core/errors";
import { db } from "@/lib/db";
import { credentialsSchema } from "@/lib/validation/credentials";
import { verifyPassword } from "@/lib/password";

// Extracted from src/auth.ts so the actual login business logic — status
// branching, the null-passwordHash short-circuit, password verification —
// is testable directly against a real database, without needing Next.js's
// request-scoped session machinery that auth.ts's signIn()/auth() require.
//
// Named error classes so the login page can show the specific messages
// specs/01-accounts-and-ranges.md requires, without leaking which case it was
// for the two that must stay generic (wrong password vs. no such account).
// error.code (not error.type, which is always "CredentialsSignin" for the
// whole family) is what distinguishes them — see src/app/login/actions.ts.
export class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid-credentials";
}
export class AwaitingActivationError extends CredentialsSignin {
  code = "awaiting-activation";
}
export class PendingApprovalError extends CredentialsSignin {
  code = "pending-approval";
}
export class RejectedError extends CredentialsSignin {
  code = "rejected";
}
export class DeactivatedError extends CredentialsSignin {
  code = "deactivated";
}

export async function authorizeCredentials(rawCredentials: unknown) {
  const parsed = credentialsSchema.safeParse(rawCredentials);
  if (!parsed.success) throw new InvalidCredentialsError();
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });

  // Same generic error whether the account doesn't exist or the password is
  // wrong — never reveal which, to avoid account enumeration (spec 01,
  // Behaviour: Login).
  if (!user) throw new InvalidCredentialsError();

  // passwordHash === null means an admin-invited account that hasn't
  // accepted its invite yet — checked *before* attempting any bcrypt compare
  // against a null hash (spec 01, Edge Case #21).
  if (!user.passwordHash) throw new AwaitingActivationError();

  const passwordMatches = await verifyPassword(password, user.passwordHash);
  if (!passwordMatches) throw new InvalidCredentialsError();

  // Only after the password is verified do we branch on account status
  // (spec 01: never reveal status to an unauthenticated caller before the
  // password check passes).
  if (user.status === "PENDING") throw new PendingApprovalError();
  if (user.status === "REJECTED") throw new RejectedError();
  if (user.status === "DEACTIVATED") throw new DeactivatedError();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    isRso: user.isRso,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin,
    sessionVersion: user.sessionVersion,
  };
}
