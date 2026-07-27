import { describe, expect, it } from "vitest";
import {
  acceptInviteSchema,
  forgotPasswordSchema,
  inviteMemberSchema,
  patchMemberSchema,
  registerSchema,
  rejectMemberSchema,
  resetPasswordSchema,
  setAdminSchema,
  setRsoSchema,
} from "./members";

describe("registerSchema", () => {
  it("accepts a fully valid registration", () => {
    const result = registerSchema.safeParse({
      email: "member@example.com",
      password: "hunter22",
      name: "Test Member",
      membershipNumber: "0001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      email: "member@example.com",
      password: "short",
      name: "Test Member",
      membershipNumber: "0001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank/whitespace-only membershipNumber (Edge Case #18)", () => {
    const result = registerSchema.safeParse({
      email: "member@example.com",
      password: "hunter22",
      name: "Test Member",
      membershipNumber: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = registerSchema.safeParse({
      email: "member@example.com",
      password: "hunter22",
      name: "",
      membershipNumber: "0001",
    });
    expect(result.success).toBe(false);
  });
});

describe("inviteMemberSchema", () => {
  it("accepts name/email/membershipNumber with no password field", () => {
    const result = inviteMemberSchema.safeParse({
      email: "invitee@example.com",
      name: "Invitee",
      membershipNumber: "0002",
    });
    expect(result.success).toBe(true);
  });
});

describe("patchMemberSchema", () => {
  it("accepts a single field", () => {
    expect(patchMemberSchema.safeParse({ name: "New Name" }).success).toBe(true);
  });

  it("rejects an empty body", () => {
    expect(patchMemberSchema.safeParse({}).success).toBe(false);
  });
});

describe("rejectMemberSchema", () => {
  it("accepts a missing rejectedReason (optional)", () => {
    expect(rejectMemberSchema.safeParse({}).success).toBe(true);
  });

  it("accepts a provided rejectedReason", () => {
    expect(rejectMemberSchema.safeParse({ rejectedReason: "Not found in membership sheet" }).success).toBe(true);
  });
});

describe("setRsoSchema / setAdminSchema", () => {
  it("require a boolean isRso / isAdmin", () => {
    expect(setRsoSchema.safeParse({ isRso: true }).success).toBe(true);
    expect(setRsoSchema.safeParse({ isRso: "yes" }).success).toBe(false);
    expect(setAdminSchema.safeParse({ isAdmin: false }).success).toBe(true);
    expect(setAdminSchema.safeParse({}).success).toBe(false);
  });
});

describe("forgotPasswordSchema / resetPasswordSchema / acceptInviteSchema", () => {
  it("forgotPasswordSchema requires a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "person@example.com" }).success).toBe(true);
  });

  it("resetPasswordSchema requires a token and an 8+ char password", () => {
    expect(resetPasswordSchema.safeParse({ token: "abc", newPassword: "short" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: "abc", newPassword: "longenough" }).success).toBe(true);
  });

  it("acceptInviteSchema requires a token and an 8+ char password", () => {
    expect(acceptInviteSchema.safeParse({ token: "abc", password: "short" }).success).toBe(false);
    expect(acceptInviteSchema.safeParse({ token: "abc", password: "longenough" }).success).toBe(true);
  });
});
