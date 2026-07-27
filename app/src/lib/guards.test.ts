import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

// Mocked before importing guards.ts, which imports `auth` from this module —
// spec 01's test plan calls for "all four access-control guards in isolation
// (mocked session)". Explicitly typed as the no-args overload (auth() is
// otherwise overloaded to also work as Next.js middleware, which confuses
// vi.mocked()'s inferred type).
vi.mock("@/auth", () => ({
  auth: vi.fn<() => Promise<Session | null>>(),
}));

const { auth } = await import("@/auth");
const mockAuth = auth as unknown as ReturnType<typeof vi.fn<() => Promise<Session | null>>>;
const { requireAuth, requireApprovedMember, requireAdmin, requireSuperAdmin } = await import("./guards");
const { HttpError } = await import("./http-error");

function fakeSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: {
      id: "user-1",
      status: "APPROVED",
      isRso: false,
      isAdmin: false,
      isSuperAdmin: false,
      ...overrides,
    },
    expires: new Date(Date.now() + 60_000).toISOString(),
  } as Session;
}

beforeEach(() => {
  mockAuth.mockReset();
});

describe("requireAuth", () => {
  it("returns the session when authenticated", async () => {
    mockAuth.mockResolvedValue(fakeSession());
    await expect(requireAuth()).resolves.toMatchObject({ user: { id: "user-1" } });
  });

  it("throws 401 when there is no session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireAuth()).rejects.toMatchObject(new HttpError(401, "Authentication required"));
  });
});

describe("requireApprovedMember", () => {
  it("passes for an APPROVED user", async () => {
    mockAuth.mockResolvedValue(fakeSession({ status: "APPROVED" }));
    await expect(requireApprovedMember()).resolves.toBeDefined();
  });

  it.each(["PENDING", "REJECTED", "DEACTIVATED"] as const)("rejects a %s user with 403", async (status) => {
    mockAuth.mockResolvedValue(fakeSession({ status }));
    await expect(requireApprovedMember()).rejects.toMatchObject({ status: 403 });
  });

  it("throws 401 when there is no session at all", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireApprovedMember()).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireAdmin", () => {
  it("passes for isAdmin = true", async () => {
    mockAuth.mockResolvedValue(fakeSession({ isAdmin: true }));
    await expect(requireAdmin()).resolves.toBeDefined();
  });

  it("passes for isSuperAdmin = true even if isAdmin is false", async () => {
    mockAuth.mockResolvedValue(fakeSession({ isAdmin: false, isSuperAdmin: true }));
    await expect(requireAdmin()).resolves.toBeDefined();
  });

  it("rejects a plain member with 403", async () => {
    mockAuth.mockResolvedValue(fakeSession({ isAdmin: false, isSuperAdmin: false }));
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
  });
});

describe("requireSuperAdmin", () => {
  it("passes for isSuperAdmin = true", async () => {
    mockAuth.mockResolvedValue(fakeSession({ isSuperAdmin: true }));
    await expect(requireSuperAdmin()).resolves.toBeDefined();
  });

  it("rejects a regular Admin (isAdmin=true, isSuperAdmin=false) with 403 — Edge Case #4", async () => {
    mockAuth.mockResolvedValue(fakeSession({ isAdmin: true, isSuperAdmin: false }));
    await expect(requireSuperAdmin()).rejects.toMatchObject({ status: 403 });
  });
});
