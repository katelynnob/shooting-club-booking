import { randomBytes, createHash } from "node:crypto";

// Used by both the invite flow and password reset (specs/01-accounts-and-ranges.md,
// AccountToken model) — the raw token is what gets emailed to the user; only
// its hash is ever stored, so a database read alone can never produce a
// usable token.
export function generateRawToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
