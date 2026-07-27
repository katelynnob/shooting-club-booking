import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "./test-db";
import { hashToken } from "@/lib/tokens";
import { verifyPassword } from "@/lib/password";

// accept-invite calls Auth.js's signIn() directly to log the member straight
// in (spec 01, Acceptance Criterion #23) — that call requires Next.js's
// request-scoped cookie machinery, which only exists inside a real running
// server, not a direct function invocation from Vitest. Mocked here so the
// *business logic* (token consumption, password set, correct call made) is
// still verified against the real database; the actual signIn()/cookie
// mechanics were already verified manually end-to-end in a real browser
// (see GETTING_STARTED.md's NextAuth step) using the same underlying call.
vi.mock("@/auth", () => ({ signIn: vi.fn() }));

const { signIn } = await import("@/auth");
const mockSignIn = signIn as unknown as ReturnType<typeof vi.fn>;
const { POST: acceptInvite } = await import("@/app/api/auth/accept-invite/route");

const TEST_EMAIL = "accept-invite-test@example.com";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/auth/accept-invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockSignIn.mockReset();
  mockSignIn.mockResolvedValue(undefined);
});

afterEach(async () => {
  const user = await testDb.user.findUnique({ where: { email: TEST_EMAIL } });
  if (user) await testDb.accountToken.deleteMany({ where: { userId: user.id } });
  await testDb.user.deleteMany({ where: { email: TEST_EMAIL } });
});

describe("POST /api/auth/accept-invite", () => {
  it("sets the password, marks the token used, and logs the member in (AC #23)", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: null, name: "Test", membershipNumber: "AI-1", status: "APPROVED" },
    });
    const rawToken = "invite-token-ai1";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "INVITE", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    });

    const response = await acceptInvite(jsonRequest({ token: rawToken, password: "new-password-123" }));
    expect(response.status).toBe(200);

    const updated = await testDb.user.findUnique({ where: { id: user.id } });
    expect(updated?.passwordHash).not.toBeNull();
    expect(await verifyPassword("new-password-123", updated!.passwordHash!)).toBe(true);

    const token = await testDb.accountToken.findFirst({ where: { userId: user.id, purpose: "INVITE" } });
    expect(token?.usedAt).not.toBeNull();

    // Same authorize() flow as a normal login, re-run with the just-set
    // password — not a bespoke "trust me" session-creation path.
    expect(mockSignIn).toHaveBeenCalledWith("credentials", {
      email: TEST_EMAIL,
      password: "new-password-123",
      redirect: false,
    });
  });

  it("rejects an expired invite token (Edge Case #23)", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: null, name: "Test", membershipNumber: "AI-2", status: "APPROVED" },
    });
    const rawToken = "invite-token-ai2";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "INVITE", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() - 1000) },
    });

    const response = await acceptInvite(jsonRequest({ token: rawToken, password: "new-password-123" }));
    expect(response.status).toBe(400);
    expect(mockSignIn).not.toHaveBeenCalled();
  });

  it("rejects an already-used invite token", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: null, name: "Test", membershipNumber: "AI-3", status: "APPROVED" },
    });
    const rawToken = "invite-token-ai3";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "INVITE", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60_000), usedAt: new Date() },
    });

    const response = await acceptInvite(jsonRequest({ token: rawToken, password: "new-password-123" }));
    expect(response.status).toBe(400);
  });

  it("rejects a token that never existed", async () => {
    const response = await acceptInvite(jsonRequest({ token: "never-existed", password: "new-password-123" }));
    expect(response.status).toBe(400);
  });

  it("rejects a PASSWORD_RESET-purpose token used here — cross-purpose redemption blocked (Edge Case #26)", async () => {
    const user = await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: "irrelevant-existing-hash", name: "Test", membershipNumber: "AI-4", status: "APPROVED" },
    });
    const rawToken = "reset-token-ai4";
    await testDb.accountToken.create({
      data: { userId: user.id, purpose: "PASSWORD_RESET", tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + 60_000) },
    });

    const response = await acceptInvite(jsonRequest({ token: rawToken, password: "new-password-123" }));
    expect(response.status).toBe(400);
    expect(mockSignIn).not.toHaveBeenCalled();
  });
});
