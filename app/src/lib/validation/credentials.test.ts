import { describe, expect, it } from "vitest";
import { credentialsSchema } from "./credentials";

describe("credentialsSchema", () => {
  it("accepts a well-formed email and non-empty password", () => {
    const result = credentialsSchema.safeParse({
      email: "member@example.com",
      password: "hunter2",
    });
    expect(result.success).toBe(true);
  });

  it("normalizes email to lowercase and trims whitespace", () => {
    const result = credentialsSchema.safeParse({
      email: "  Member@Example.COM  ",
      password: "hunter2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("member@example.com");
    }
  });

  it("rejects a malformed email", () => {
    const result = credentialsSchema.safeParse({
      email: "not-an-email",
      password: "hunter2",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = credentialsSchema.safeParse({
      email: "member@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields entirely", () => {
    const result = credentialsSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
