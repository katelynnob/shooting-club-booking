import { db } from "@/lib/db";
import { generateRawToken, hashToken, INVITE_TOKEN_TTL_MS, PASSWORD_RESET_TOKEN_TTL_MS } from "@/lib/tokens";
import type { AccountTokenPurpose } from "@/generated/prisma/enums";

// Shared by admin-invite creation, resend-invite, and forgot-password (when
// the matched account hasn't accepted its invite yet) — specs/01-accounts-and-ranges.md.
// Invalidates any previously-issued unused token of the same purpose first,
// so only the most recently issued link ever works (Edge Cases #16, #25).
async function issueToken(userId: string, purpose: AccountTokenPurpose, ttlMs: number): Promise<string> {
  await db.accountToken.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = generateRawToken();
  await db.accountToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });
  return rawToken;
}

export function issueInviteToken(userId: string): Promise<string> {
  return issueToken(userId, "INVITE", INVITE_TOKEN_TTL_MS);
}

export function issuePasswordResetToken(userId: string): Promise<string> {
  return issueToken(userId, "PASSWORD_RESET", PASSWORD_RESET_TOKEN_TTL_MS);
}

/**
 * Looks up a raw token by its hash, scoped to `purpose` (Edge Case #26: an
 * INVITE token must never be redeemable via reset-password, and vice versa).
 * Returns the associated userId and marks the token used, or null if it
 * wasn't found / already used / expired / the wrong purpose — every one of
 * those cases collapses to the same generic result so callers can give the
 * same "invalid or expired link" message regardless of which it was.
 */
export async function consumeToken(rawToken: string, purpose: AccountTokenPurpose): Promise<{ userId: string } | null> {
  const token = await db.accountToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });

  if (!token || token.purpose !== purpose || token.usedAt || token.expiresAt < new Date()) {
    return null;
  }

  await db.accountToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return { userId: token.userId };
}
