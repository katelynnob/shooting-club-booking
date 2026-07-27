import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "./test-db";
import { fakeSession } from "./fake-session";
import { hashPassword } from "@/lib/password";
import { hashToken } from "@/lib/tokens";

// Route handlers call requireAdmin()/requireSuperAdmin() (see src/lib/guards.ts),
// which call auth() — that needs Next.js's request-scoped cookie machinery,
// unavailable outside a real running server. Mocked here so every test can
// simulate "logged in as X role" directly; all the actual business logic
// (DB reads/writes, status transitions, audit fields, sessionVersion) still
// runs for real against the test database. See fake-session.ts.
vi.mock("@/auth", () => ({ auth: vi.fn() }));
// sendEmail is stubbed (real implementation lands with spec 02) but mocked
// here specifically so we can assert *what* it was called with — e.g. that
// rejectedReason never reaches the applicant-facing email.
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn().mockResolvedValue({ success: true }) }));

const { auth } = await import("@/auth");
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const { sendEmail } = await import("@/lib/email");
const mockSendEmail = sendEmail as unknown as ReturnType<typeof vi.fn>;

const { GET: listMembers } = await import("@/app/api/admin/members/route");
const { POST: inviteMember } = await import("@/app/api/admin/members/invite/route");
const { POST: approveMember } = await import("@/app/api/admin/members/[id]/approve/route");
const { POST: rejectMember } = await import("@/app/api/admin/members/[id]/reject/route");
const { POST: deactivateMember } = await import("@/app/api/admin/members/[id]/deactivate/route");
const { POST: reactivateMember } = await import("@/app/api/admin/members/[id]/reactivate/route");
const { POST: setRso } = await import("@/app/api/admin/members/[id]/set-rso/route");
const { POST: setAdmin } = await import("@/app/api/admin/members/[id]/set-admin/route");
const { POST: resendInvite } = await import("@/app/api/admin/members/[id]/resend-invite/route");
const { PATCH: patchMember } = await import("@/app/api/admin/members/[id]/route");

const ADMIN_SESSION = fakeSession({ id: "admin-1", isAdmin: true });
const SUPER_ADMIN_SESSION = fakeSession({ id: "super-admin-1", isAdmin: false, isSuperAdmin: true });
const MEMBER_SESSION = fakeSession({ id: "member-1", isAdmin: false });

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

async function createTestUser(overrides: Partial<Parameters<typeof testDb.user.create>[0]["data"]> = {}) {
  return testDb.user.create({
    data: {
      email: `member-${Math.random().toString(36).slice(2)}@example.com`,
      passwordHash: await hashPassword("hunter22"),
      name: "Test Member",
      membershipNumber: `M-${Math.random().toString(36).slice(2)}`,
      status: "PENDING",
      ...overrides,
    },
  });
}

beforeEach(() => {
  mockAuth.mockReset();
  mockSendEmail.mockClear();
});

afterEach(async () => {
  await testDb.accountToken.deleteMany({});
  await testDb.user.deleteMany({ where: { email: { contains: "@example.com" } } });
});

describe("guard enforcement (403/401 sweep — Acceptance Criterion #10, Edge Case #13)", () => {
  // Table-driven, per spec 01's test plan ("a table-driven test iterating
  // all admin routes, not one-off spot checks") — every /api/admin/members*
  // route, called with a fake (non-existent) target id where relevant. The
  // guard runs before any DB lookup in every handler, so a fake id never
  // masks the 403 with a 404.
  const FAKE_ID = "does-not-exist";
  const ALL_MEMBER_ADMIN_ROUTES: [string, () => Promise<Response>][] = [
    ["GET /api/admin/members", () => listMembers(jsonRequest("http://localhost/api/admin/members", "GET"))],
    [
      "POST /api/admin/members/invite",
      () => inviteMember(jsonRequest("http://localhost/api/admin/members/invite", "POST", { email: "x@example.com", name: "X", membershipNumber: "X-1" })),
    ],
    [
      "POST /api/admin/members/:id/approve",
      () => approveMember(jsonRequest(`http://localhost/api/admin/members/${FAKE_ID}/approve`, "POST"), idParams(FAKE_ID)),
    ],
    [
      "POST /api/admin/members/:id/reject",
      () => rejectMember(jsonRequest(`http://localhost/api/admin/members/${FAKE_ID}/reject`, "POST", {}), idParams(FAKE_ID)),
    ],
    [
      "POST /api/admin/members/:id/deactivate",
      () => deactivateMember(jsonRequest(`http://localhost/api/admin/members/${FAKE_ID}/deactivate`, "POST"), idParams(FAKE_ID)),
    ],
    [
      "POST /api/admin/members/:id/reactivate",
      () => reactivateMember(jsonRequest(`http://localhost/api/admin/members/${FAKE_ID}/reactivate`, "POST"), idParams(FAKE_ID)),
    ],
    [
      "POST /api/admin/members/:id/set-rso",
      () => setRso(jsonRequest(`http://localhost/api/admin/members/${FAKE_ID}/set-rso`, "POST", { isRso: true }), idParams(FAKE_ID)),
    ],
    [
      "POST /api/admin/members/:id/resend-invite",
      () => resendInvite(jsonRequest(`http://localhost/api/admin/members/${FAKE_ID}/resend-invite`, "POST"), idParams(FAKE_ID)),
    ],
    [
      "PATCH /api/admin/members/:id",
      () => patchMember(jsonRequest(`http://localhost/api/admin/members/${FAKE_ID}`, "PATCH", { name: "X" }), idParams(FAKE_ID)),
    ],
  ];

  it.each(ALL_MEMBER_ADMIN_ROUTES)("%s returns 403 for a non-admin member", async (_label, callRoute) => {
    mockAuth.mockResolvedValue(MEMBER_SESSION);
    expect((await callRoute()).status).toBe(403);
  });

  it.each(ALL_MEMBER_ADMIN_ROUTES)("%s returns 401 with no session at all", async (_label, callRoute) => {
    mockAuth.mockResolvedValue(null);
    expect((await callRoute()).status).toBe(401);
  });

  it.each(ALL_MEMBER_ADMIN_ROUTES)("%s succeeds past the guard for a regular Admin (may still 404/400 on the fake id, but never 401/403)", async (_label, callRoute) => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const status = (await callRoute()).status;
    expect(status).not.toBe(401);
    expect(status).not.toBe(403);
  });

  it("set-admin returns 403 for a regular Admin, even though they pass requireAdmin everywhere else (Edge Case #4, AC #6)", async () => {
    const target = await createTestUser({ status: "APPROVED" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await setAdmin(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/set-admin`, "POST", { isAdmin: true }),
      idParams(target.id),
    );
    expect(response.status).toBe(403);
  });

  it("set-admin succeeds for the Super Admin", async () => {
    const target = await createTestUser({ status: "APPROVED" });
    mockAuth.mockResolvedValue(SUPER_ADMIN_SESSION);
    const response = await setAdmin(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/set-admin`, "POST", { isAdmin: true }),
      idParams(target.id),
    );
    expect(response.status).toBe(200);
    const updated = await testDb.user.findUnique({ where: { id: target.id } });
    expect(updated?.isAdmin).toBe(true);
  });
});

describe("approve / reject (Acceptance Criteria #3, #4, #19)", () => {
  it("approves a PENDING member and records the audit trail (AC #19)", async () => {
    const target = await createTestUser({ status: "PENDING" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await approveMember(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/approve`, "POST"),
      idParams(target.id),
    );
    expect(response.status).toBe(200);

    const updated = await testDb.user.findUnique({ where: { id: target.id } });
    expect(updated?.status).toBe("APPROVED");
    expect(updated?.approvedByUserId).toBe(ADMIN_SESSION.user.id);
    expect(updated?.approvedAt).not.toBeNull();
  });

  it("rejects approving a non-PENDING member", async () => {
    const target = await createTestUser({ status: "APPROVED" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await approveMember(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/approve`, "POST"),
      idParams(target.id),
    );
    expect(response.status).toBe(409);
  });

  it("rejects a PENDING member with a stored reason, never shown back to the caller (AC #4)", async () => {
    const target = await createTestUser({ status: "PENDING" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await rejectMember(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/reject`, "POST", { rejectedReason: "Not found in sheet" }),
      idParams(target.id),
    );
    expect(response.status).toBe(200);

    const updated = await testDb.user.findUnique({ where: { id: target.id } });
    expect(updated?.status).toBe("REJECTED");
    // Admin's own API response legitimately includes rejectedReason (they
    // wrote it) — the actual privacy rule is that the *applicant's* email
    // never contains it.
    expect(updated?.rejectedReason).toBe("Not found in sheet");

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ template: "member-rejected", data: expect.not.objectContaining({ rejectedReason: expect.anything() }) }),
    );
  });
});

describe("deactivate / reactivate (Acceptance Criteria #5, #6, #7, #8; Edge Cases #5, #6, #7)", () => {
  it("deactivates an APPROVED member and increments sessionVersion (AC #5, Edge Case #7)", async () => {
    const target = await createTestUser({ status: "APPROVED" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await deactivateMember(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/deactivate`, "POST"),
      idParams(target.id),
    );
    expect(response.status).toBe(200);

    const updated = await testDb.user.findUnique({ where: { id: target.id } });
    expect(updated?.status).toBe("DEACTIVATED");
    expect(updated?.sessionVersion).toBe(target.sessionVersion + 1);
  });

  it("blocks deactivating the Super Admin's account, even by another admin (AC #7, Edge Case #5)", async () => {
    const superAdminUser = await createTestUser({ status: "APPROVED", isSuperAdmin: true });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await deactivateMember(
      jsonRequest(`http://localhost/api/admin/members/${superAdminUser.id}/deactivate`, "POST"),
      idParams(superAdminUser.id),
    );
    expect(response.status).toBe(403);

    const stillApproved = await testDb.user.findUnique({ where: { id: superAdminUser.id } });
    expect(stillApproved?.status).toBe("APPROVED");
  });

  it("blocks the Super Admin from deactivating their own account too (AC #7)", async () => {
    const superAdminUser = await createTestUser({
      status: "APPROVED",
      isSuperAdmin: true,
      id: SUPER_ADMIN_SESSION.user.id,
    });
    mockAuth.mockResolvedValue(SUPER_ADMIN_SESSION);

    const response = await deactivateMember(
      jsonRequest(`http://localhost/api/admin/members/${superAdminUser.id}/deactivate`, "POST"),
      idParams(superAdminUser.id),
    );
    expect(response.status).toBe(403);
  });

  it("blocks a regular Admin from deactivating their own account (AC #8, Edge Case #6)", async () => {
    const adminUser = await createTestUser({ status: "APPROVED", isAdmin: true, id: ADMIN_SESSION.user.id });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await deactivateMember(
      jsonRequest(`http://localhost/api/admin/members/${adminUser.id}/deactivate`, "POST"),
      idParams(adminUser.id),
    );
    expect(response.status).toBe(403);
  });

  it("reactivates a DEACTIVATED member back to APPROVED", async () => {
    const target = await createTestUser({ status: "DEACTIVATED" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await reactivateMember(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/reactivate`, "POST"),
      idParams(target.id),
    );
    expect(response.status).toBe(200);
    const updated = await testDb.user.findUnique({ where: { id: target.id } });
    expect(updated?.status).toBe("APPROVED");
  });
});

describe("set-rso (Edge Case #11)", () => {
  it("can be set on a PENDING account ahead of approval", async () => {
    const target = await createTestUser({ status: "PENDING" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await setRso(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/set-rso`, "POST", { isRso: true }),
      idParams(target.id),
    );
    expect(response.status).toBe(200);
    const updated = await testDb.user.findUnique({ where: { id: target.id } });
    expect(updated?.isRso).toBe(true);
  });
});

describe("PATCH /api/admin/members/:id (Acceptance Criterion #21, Edge Case #20)", () => {
  it("corrects a member's membershipNumber", async () => {
    const target = await createTestUser({ status: "APPROVED", membershipNumber: "OLD-123" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await patchMember(
      jsonRequest(`http://localhost/api/admin/members/${target.id}`, "PATCH", { membershipNumber: "NEW-456" }),
      idParams(target.id),
    );
    expect(response.status).toBe(200);
    const updated = await testDb.user.findUnique({ where: { id: target.id } });
    expect(updated?.membershipNumber).toBe("NEW-456");
  });

  it("rejects a membershipNumber that collides with another member", async () => {
    const other = await createTestUser({ status: "APPROVED", membershipNumber: "TAKEN-1" });
    const target = await createTestUser({ status: "APPROVED", membershipNumber: "MINE-1" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await patchMember(
      jsonRequest(`http://localhost/api/admin/members/${target.id}`, "PATCH", { membershipNumber: other.membershipNumber }),
      idParams(target.id),
    );
    expect(response.status).toBe(409);
  });
});

describe("invite / resend-invite (Acceptance Criteria #22, #25, #27)", () => {
  it("creates an APPROVED, passwordless account and issues an invite token (AC #22)", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await inviteMember(
      jsonRequest("http://localhost/api/admin/members/invite", "POST", {
        email: "invitee-admin-test@example.com",
        name: "Invitee",
        membershipNumber: "INV-1",
      }),
    );
    expect(response.status).toBe(201);

    const created = await testDb.user.findUnique({ where: { email: "invitee-admin-test@example.com" } });
    expect(created?.status).toBe("APPROVED");
    expect(created?.passwordHash).toBeNull();
    expect(created?.approvedByUserId).toBe(ADMIN_SESSION.user.id);

    const tokens = await testDb.accountToken.findMany({ where: { userId: created!.id, purpose: "INVITE" } });
    expect(tokens).toHaveLength(1);
  });

  it("rejects inviting an email that already exists", async () => {
    const existing = await createTestUser({ status: "APPROVED" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await inviteMember(
      jsonRequest("http://localhost/api/admin/members/invite", "POST", {
        email: existing.email,
        name: "Someone",
        membershipNumber: "INV-2",
      }),
    );
    expect(response.status).toBe(409);
  });

  it("rejects inviting a membershipNumber that already exists (AC #27)", async () => {
    const existing = await createTestUser({ status: "APPROVED" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await inviteMember(
      jsonRequest("http://localhost/api/admin/members/invite", "POST", {
        email: "brand-new@example.com",
        name: "Someone",
        membershipNumber: existing.membershipNumber,
      }),
    );
    expect(response.status).toBe(409);
  });

  it("resend-invite invalidates the prior token and issues a new one (AC #25)", async () => {
    const target = await createTestUser({ status: "APPROVED", passwordHash: null });
    const firstToken = await testDb.accountToken.create({
      data: { userId: target.id, purpose: "INVITE", tokenHash: hashToken("first-token"), expiresAt: new Date(Date.now() + 60_000) },
    });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await resendInvite(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/resend-invite`, "POST"),
      idParams(target.id),
    );
    expect(response.status).toBe(200);

    const refreshedFirst = await testDb.accountToken.findUnique({ where: { id: firstToken.id } });
    expect(refreshedFirst?.usedAt).not.toBeNull();

    const unused = await testDb.accountToken.findMany({ where: { userId: target.id, purpose: "INVITE", usedAt: null } });
    expect(unused).toHaveLength(1);
  });

  it("rejects resend-invite once the account already has a password (Edge Case #24)", async () => {
    const target = await createTestUser({ status: "APPROVED" }); // has a passwordHash from createTestUser's default
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await resendInvite(
      jsonRequest(`http://localhost/api/admin/members/${target.id}/resend-invite`, "POST"),
      idParams(target.id),
    );
    expect(response.status).toBe(409);
  });
});

describe("GET /api/admin/members (Acceptance Criterion #20)", () => {
  it("surfaces name and membershipNumber for PENDING rows", async () => {
    await createTestUser({ status: "PENDING", name: "Pending Person", membershipNumber: "PEND-1" });
    mockAuth.mockResolvedValue(ADMIN_SESSION);

    const response = await listMembers(jsonRequest("http://localhost/api/admin/members?status=PENDING", "GET"));
    expect(response.status).toBe(200);
    const body = await response.json();
    const found = body.members.find((m: { membershipNumber: string }) => m.membershipNumber === "PEND-1");
    expect(found).toBeDefined();
    expect(found.name).toBe("Pending Person");
    expect(found.passwordHash).toBeUndefined();
  });
});
