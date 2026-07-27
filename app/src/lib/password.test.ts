import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("never stores the plaintext password", async () => {
    const hash = await hashPassword("hunter22");
    expect(hash).not.toBe("hunter22");
  });

  it("produces a real bcrypt hash — Acceptance Criterion #9's $2b$ format check", async () => {
    const hash = await hashPassword("hunter22");
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it("verifies the correct password against its own hash", async () => {
    const hash = await hashPassword("hunter22");
    await expect(verifyPassword("hunter22", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password against a real hash", async () => {
    const hash = await hashPassword("hunter22");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time even for the same password (random salt)", async () => {
    const a = await hashPassword("hunter22");
    const b = await hashPassword("hunter22");
    expect(a).not.toBe(b);
  });
});
