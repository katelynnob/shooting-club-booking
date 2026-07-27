import bcrypt from "bcryptjs";

// specs/01-accounts-and-ranges.md: "Password stored as a bcrypt hash (cost
// factor 12), never plaintext, never logged." Centralized here so the cost
// factor is defined once, not copy-pasted at every call site.
const BCRYPT_COST_FACTOR = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST_FACTOR);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
