import { afterEach, describe, expect, it } from "vitest";
import { testDb } from "./test-db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";

// specs/01-accounts-and-ranges.md — Acceptance Criteria #14, #15, #16, #26;
// Edge Cases #14, #15, #16, #17, #26.

const TEST_EMAIL = "reset-test@example.com";

function jsonRequest(url: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  const user = await testDb.user.findUnique({ where: { email: TEST_EMAIL } });
  if (user) await testDb.accountToken.deleteMany({ where: { userId: user.id } });
  await testDb.user.deleteMany({ where: { email: TEST_EMAIL } });
});

describe("POST /api/auth/forgot-password", () => {
  it("returns byte-for-byte the same response for a real vs. non-existent email (AC #14, Edge Case #14)", async () => {
    await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: await hashPassword("hunter22"), name: "Test", membershipNumber: "FP-1", status: "APPROVED" },
    });

    const realResponse = await forgotPassword(jsonRequest("http://localhost/api/auth/forgot-password", { email: TEST_EMAIL }));
    const fakeResponse = await forgotPassword(
      jsonRequest("http://localhost/api/auth/forgot-password", { email: "does-not-exist@example.com" }),
    );

    expect(realResponse.status).toBe(fakeResponse.status);
    expect(await realResponse.json()).toEqual(await fakeResponse.json());
  });

  it("issues a PASSWORD_RESET token for a real account with a password", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: await hashPassword("hunter22"), name: "Test", membershipNumber: "FP-2", status: "APPROVED" },
    });

    await forgotPassword(jsonRequest("http://localhost/api/auth/forgot-password", { email: TEST_EMAIL }));

    const tokens = await testDb.accountToken.findMany({ where: { userId: user.id, purpose: "PASSWORD_RESET" } });
    expect(tokens).toHaveLength(1);
    expect(tokens[0].usedAt).toBeNull();
  });

  it("issues an INVITE token (not a reset) when the account has no password yet", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: null, name: "Test", membershipNumber: "FP-3", status: "APPROVED" },
    });

    await forgotPassword(jsonRequest("http://localhost/api/auth/forgot-password", { email: TEST_EMAIL }));

    const resetTokens = await testDb.accountToken.findMany({ where: { userId: user.id, purpose: "PASSWORD_RESET" } });
    const inviteTokens = await testDb.accountToken.findMany({ where: { userId: user.id, purpose: "INVITE" } });
    expect(resetTokens).toHaveLength(0);
    expect(inviteTokens).toHaveLength(1);
  });

  it("invalidates the previous token when a second reset is requested (Edge Case #16)", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: await hashPassword("hunter22"), name: "Test", membershipNumber: "FP-4", status: "APPROVED" },
    });

    await forgotPassword(jsonRequest("http://localhost/api/auth/forgot-password", { email: TEST_EMAIL }));
    const [firstToken] = await testDb.accountToken.findMany({ where: { userId: user.id, purpose: "PASSWORD_RESET" } });

    await forgotPassword(jsonRequest("http://localhost/api/auth/forgot-password", { email: TEST_EMAIL }));

    const refreshedFirst = await testDb.accountToken.findUnique({ where: { id: firstToken.id } });
    expect(refreshedFirst?.usedAt).not.toBeNull();

    const unusedTokens = await testDb.accountToken.findMany({
      where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null },
    });
    expect(unusedTokens).toHaveLength(1);
  });
});

describe("POST /api/auth/reset-password", () => {
  it("updates the password and increments sessionVersion (AC #16, Edge Case #17)", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: await hashPassword("old-password"), name: "Test", membershipNumber: "RP-1", status: "APPROVED" },
    });
    const rawToken = "reset-token-rp1";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "PASSWORD_RESET", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    });

    const response = await resetPassword(
      jsonRequest("http://localhost/api/auth/reset-password", { token: rawToken, newPassword: "new-password-123" }),
    );
    expect(response.status).toBe(200);

    const updated = await testDb.user.findUnique({ where: { id: user.id } });
    expect(updated?.sessionVersion).toBe(user.sessionVersion + 1);
    expect(await verifyPassword("new-password-123", updated!.passwordHash!)).toBe(true);
  });

  it("rejects an expired token (AC #15, Edge Case #15)", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: await hashPassword("old-password"), name: "Test", membershipNumber: "RP-2", status: "APPROVED" },
    });
    const rawToken = "reset-token-rp2";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "PASSWORD_RESET", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await resetPassword(
      jsonRequest("http://localhost/api/auth/reset-password", { token: rawToken, newPassword: "new-password-123" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an already-used token", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: await hashPassword("old-password"), name: "Test", membershipNumber: "RP-3", status: "APPROVED" },
    });
    const rawToken = "reset-token-rp3";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "PASSWORD_RESET", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() },
    });

    const response = await resetPassword(
      jsonRequest("http://localhost/api/auth/reset-password", { token: rawToken, newPassword: "new-password-123" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a token that never existed", async () => {
    const response = await resetPassword(
      jsonRequest("http://localhost/api/auth/reset-password", { token: "totally-made-up", newPassword: "new-password-123" }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an INVITE-purpose token used here — cross-purpose redemption is blocked (Edge Case #26)", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: null, name: "Test", membershipNumber: "RP-4", status: "APPROVED" },
    });
    const rawToken = "invite-token-rp4";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "INVITE", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    });

    const response = await resetPassword(
      jsonRequest("http://localhost/api/auth/reset-password", { token: rawToken, newPassword: "new-password-123" }),
    );
    expect(response.status).toBe(400);

    // Confirm it's truly rejected, not silently redeemed.
    const stillUnused = await testDb.accountToken.findFirst({ where: { userId: user.id, purpose: "INVITE" } });
    expect(stillUnused?.usedAt).toBeNull();
  });
});
