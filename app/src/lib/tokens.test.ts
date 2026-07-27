import { describe, expect, it } from "vitest";
import { generateRawToken, hashToken, INVITE_TOKEN_TTL_MS, PASSWORD_RESET_TOKEN_TTL_MS } from "./tokens";

describe("tokens", () => {
  it("generates a random, sufficiently long token each time", () => {
    const a = generateRawToken();
    const b = generateRawToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
  });

  it("hashes the same input identically every time (deterministic)", () => {
    const raw = "some-raw-token-value";
    expect(hashToken(raw)).toBe(hashToken(raw));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashToken("token-a")).not.toBe(hashToken("token-b"));
  });

  it("never returns the raw token as its own hash", () => {
    const raw = generateRawToken();
    expect(hashToken(raw)).not.toBe(raw);
  });

  it("invite TTL is longer than password-reset TTL", () => {
    // specs/01-accounts-and-ranges.md: 7 days vs 1 hour — an invite is more
    // likely to sit unread for a few days than an active reset.
    expect(INVITE_TOKEN_TTL_MS).toBeGreaterThan(PASSWORD_RESET_TOKEN_TTL_MS);
  });
});
