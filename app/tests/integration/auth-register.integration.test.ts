import { afterEach, describe, expect, it } from "vitest";
import { testDb } from "./test-db";
import { POST } from "@/app/api/auth/register/route";

// specs/01-accounts-and-ranges.md — Acceptance Criteria #1, #2, #9, #18, #27;
// Edge Cases #1, #18, #27.

const TEST_EMAIL = "register-test@example.com";

function registerRequest(body: unknown) {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await testDb.user.deleteMany({ where: { email: { contains: "register-test" } } });
});

describe("POST /api/auth/register", () => {
  it("creates a PENDING user with a bcrypt-hashed password (AC #1, #9)", async () => {
    const response = await POST(
      registerRequest({
        email: TEST_EMAIL,
        password: "hunter22",
        name: "Test Member",
        membershipNumber: "REG-1",
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.status).toBe("PENDING");

    const dbUser = await testDb.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(dbUser?.status).toBe("PENDING");
    expect(dbUser?.passwordHash).not.toBe("hunter22");
    expect(dbUser?.passwordHash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it("rejects an already-used email (any casing) without creating a duplicate row (AC #2, Edge Case #1)", async () => {
    await POST(registerRequest({ email: TEST_EMAIL, password: "hunter22", name: "Test", membershipNumber: "REG-2" }));

    const secondAttempt = await POST(
      registerRequest({
        email: TEST_EMAIL.toUpperCase(),
        password: "different-password",
        name: "Someone Else",
        membershipNumber: "REG-3",
      }),
    );
    expect(secondAttempt.status).toBe(409);

    const count = await testDb.user.count({ where: { email: TEST_EMAIL } });
    expect(count).toBe(1);
  });

  it("rejects a blank/whitespace-only membershipNumber (AC #18, Edge Case #18)", async () => {
    const response = await POST(
      registerRequest({ email: TEST_EMAIL, password: "hunter22", name: "Test", membershipNumber: "   " }),
    );
    expect(response.status).toBe(400);

    const dbUser = await testDb.user.findUnique({ where: { email: TEST_EMAIL } });
    expect(dbUser).toBeNull();
  });

  it("rejects a duplicate membershipNumber across different emails (AC #27, Edge Case #27)", async () => {
    await POST(
      registerRequest({ email: TEST_EMAIL, password: "hunter22", name: "Test", membershipNumber: "REG-SHARED" }),
    );

    const secondAttempt = await POST(
      registerRequest({
        email: "register-test-2@example.com",
        password: "hunter22",
        name: "Test Two",
        membershipNumber: "REG-SHARED",
      }),
    );
    expect(secondAttempt.status).toBe(409);

    await testDb.user.deleteMany({ where: { email: "register-test-2@example.com" } });
  });

  it("rejects a password shorter than 8 characters", async () => {
    const response = await POST(
      registerRequest({ email: TEST_EMAIL, password: "short", name: "Test", membershipNumber: "REG-4" }),
    );
    expect(response.status).toBe(400);
  });

  it("does not create a session on successful registration (registration is inert until approved)", async () => {
    const response = await POST(
      registerRequest({ email: TEST_EMAIL, password: "hunter22", name: "Test", membershipNumber: "REG-5" }),
    );
    // No Set-Cookie header — nothing session-related happens on registration.
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
