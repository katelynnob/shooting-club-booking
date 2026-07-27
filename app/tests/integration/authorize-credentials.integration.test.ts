import { afterEach, describe, expect, it } from "vitest";
import { testDb } from "./test-db";
import { hashPassword } from "@/lib/password";
import {
  authorizeCredentials,
  AwaitingActivationError,
  DeactivatedError,
  InvalidCredentialsError,
  PendingApprovalError,
  RejectedError,
} from "@/lib/authorize-credentials";

// Covers specs/01-accounts-and-ranges.md's Login behaviour against a real
// database — Acceptance Criteria #1, #3, #4, #24; Edge Cases #2, #3, #21.

const TEST_EMAIL = "authorize-test@example.com";
const TEST_PASSWORD = "correct-horse-battery-staple";

afterEach(async () => {
  await testDb.user.deleteMany({ where: { email: TEST_EMAIL } });
});

describe("authorizeCredentials", () => {
  it("succeeds for an APPROVED member with the correct password", async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash, name: "Test", membershipNumber: "AC-1", status: "APPROVED" },
    });

    const result = await authorizeCredentials({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(result).toMatchObject({ email: TEST_EMAIL, status: "APPROVED" });
  });

  it("rejects the wrong password with a generic invalid-credentials error (Edge Case #3)", async () => {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash, name: "Test", membershipNumber: "AC-2", status: "APPROVED" },
    });

    await expect(authorizeCredentials({ email: TEST_EMAIL, password: "wrong" })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it("rejects a non-existent email with the same generic error as a wrong password (no enumeration)", async () => {
    await expect(
      authorizeCredentials({ email: "no-such-user@example.com", password: "whatever" }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it.each([
    ["PENDING", PendingApprovalError],
    ["REJECTED", RejectedError],
    ["DEACTIVATED", DeactivatedError],
  ] as const)("rejects a %s account with the correct password using its specific error (Edge Case #2)", async (status, ErrorClass) => {
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash, name: "Test", membershipNumber: `AC-${status}`, status },
    });

    await expect(authorizeCredentials({ email: TEST_EMAIL, password: TEST_PASSWORD })).rejects.toBeInstanceOf(
      ErrorClass,
    );
  });

  it("rejects a PENDING account with the WRONG password using the generic error, not the status-specific one", async () => {
    // Never reveal status before the password check passes (spec 01, Login).
    const passwordHash = await hashPassword(TEST_PASSWORD);
    await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash, name: "Test", membershipNumber: "AC-3", status: "PENDING" },
    });

    await expect(authorizeCredentials({ email: TEST_EMAIL, password: "wrong" })).rejects.toBeInstanceOf(
      InvalidCredentialsError,
    );
  });

  it("rejects an unaccepted invite (passwordHash null) with awaiting-activation, regardless of password string (Edge Case #21, Acceptance Criterion #24)", async () => {
    await testDb.user.create({
      data: { email: TEST_EMAIL, passwordHash: null, name: "Test", membershipNumber: "AC-4", status: "APPROVED" },
    });

    await expect(
      authorizeCredentials({ email: TEST_EMAIL, password: "literally-anything" }),
    ).rejects.toBeInstanceOf(AwaitingActivationError);
    await expect(
      authorizeCredentials({ email: TEST_EMAIL, password: "some-other-guess" }),
    ).rejects.toBeInstanceOf(AwaitingActivationError);
  });

  it("rejects malformed input (missing password) without throwing an unhandled error", async () => {
    await expect(authorizeCredentials({ email: TEST_EMAIL })).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});
