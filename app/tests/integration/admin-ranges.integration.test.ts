import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testDb } from "./test-db";
import { fakeSession } from "./fake-session";

// See admin-members.integration.test.ts for why auth() is mocked here.
vi.mock("@/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/auth");
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const { GET: publicRanges } = await import("@/app/api/ranges/route");
const { GET: adminListRanges, POST: createRange } = await import("@/app/api/admin/ranges/route");
const { PATCH: updateRange } = await import("@/app/api/admin/ranges/[id]/route");
const { POST: archiveRange } = await import("@/app/api/admin/ranges/[id]/archive/route");
const { POST: unarchiveRange } = await import("@/app/api/admin/ranges/[id]/unarchive/route");
const { PUT: replaceHours } = await import("@/app/api/admin/ranges/[id]/hours/route");

const ADMIN_SESSION = fakeSession({ id: "admin-1", isAdmin: true });
const MEMBER_SESSION = fakeSession({ id: "member-1", isAdmin: false });

const TEST_RANGE_PREFIX = "__integration_admin_range__";

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

beforeEach(() => {
  mockAuth.mockReset();
});

afterEach(async () => {
  const ranges = await testDb.range.findMany({ where: { name: { startsWith: TEST_RANGE_PREFIX } } });
  for (const range of ranges) {
    await testDb.rangeOperatingHours.deleteMany({ where: { rangeId: range.id } });
  }
  await testDb.range.deleteMany({ where: { name: { startsWith: TEST_RANGE_PREFIX } } });
});

describe("guard enforcement across all /api/admin/ranges* routes (Acceptance Criterion #10)", () => {
  const FAKE_ID = "does-not-exist";
  const ALL_RANGE_ADMIN_ROUTES: [string, () => Promise<Response>][] = [
    ["GET /api/admin/ranges", () => adminListRanges()],
    [
      "POST /api/admin/ranges",
      () => createRange(jsonRequest("http://localhost/api/admin/ranges", "POST", { name: "Guard Sweep Range", discipline: "Test", capacity: 6 })),
    ],
    [
      "PATCH /api/admin/ranges/:id",
      () => updateRange(jsonRequest(`http://localhost/api/admin/ranges/${FAKE_ID}`, "PATCH", { capacity: 8 }), idParams(FAKE_ID)),
    ],
    [
      "POST /api/admin/ranges/:id/archive",
      () => archiveRange(jsonRequest(`http://localhost/api/admin/ranges/${FAKE_ID}/archive`, "POST"), idParams(FAKE_ID)),
    ],
    [
      "POST /api/admin/ranges/:id/unarchive",
      () => unarchiveRange(jsonRequest(`http://localhost/api/admin/ranges/${FAKE_ID}/unarchive`, "POST"), idParams(FAKE_ID)),
    ],
    [
      "PUT /api/admin/ranges/:id/hours",
      () => replaceHours(jsonRequest(`http://localhost/api/admin/ranges/${FAKE_ID}/hours`, "PUT", []), idParams(FAKE_ID)),
    ],
  ];

  afterEach(async () => {
    await testDb.range.deleteMany({ where: { name: "Guard Sweep Range" } });
  });

  it.each(ALL_RANGE_ADMIN_ROUTES)("%s returns 403 for a non-admin member", async (_label, callRoute) => {
    mockAuth.mockResolvedValue(MEMBER_SESSION);
    expect((await callRoute()).status).toBe(403);
  });

  it.each(ALL_RANGE_ADMIN_ROUTES)("%s returns 401 with no session at all", async (_label, callRoute) => {
    mockAuth.mockResolvedValue(null);
    expect((await callRoute()).status).toBe(401);
  });
});

describe("range creation (Acceptance Criterion #11, Edge Case #8)", () => {
  it("creates a range with the given fields", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await createRange(
      jsonRequest("http://localhost/api/admin/ranges", "POST", {
        name: `${TEST_RANGE_PREFIX}_a`,
        discipline: "Test",
        capacity: 6,
      }),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.range.slotLengthMinutes).toBe(60); // schema default
  });

  it("rejects a duplicate name case-insensitively", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    await createRange(
      jsonRequest("http://localhost/api/admin/ranges", "POST", { name: `${TEST_RANGE_PREFIX}_B`, discipline: "Test", capacity: 6 }),
    );
    const response = await createRange(
      jsonRequest("http://localhost/api/admin/ranges", "POST", { name: `${TEST_RANGE_PREFIX}_b`, discipline: "Test", capacity: 6 }),
    );
    expect(response.status).toBe(409);
  });

  it("rejects a non-positive capacity with a field-specific error, not a generic 500", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const response = await createRange(
      jsonRequest("http://localhost/api/admin/ranges", "POST", { name: `${TEST_RANGE_PREFIX}_c`, discipline: "Test", capacity: 0 }),
    );
    expect(response.status).toBe(400);
  });

  it("is blocked for a non-admin member", async () => {
    mockAuth.mockResolvedValue(MEMBER_SESSION);
    const response = await createRange(
      jsonRequest("http://localhost/api/admin/ranges", "POST", { name: `${TEST_RANGE_PREFIX}_d`, discipline: "Test", capacity: 6 }),
    );
    expect(response.status).toBe(403);
  });
});

describe("archive / unarchive (Acceptance Criterion #12, Edge Case #10)", () => {
  it("hides an archived range from the public list but keeps it in the admin list and fetchable", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const created = await testDb.range.create({
      data: { name: `${TEST_RANGE_PREFIX}_e`, discipline: "Test", capacity: 6 },
    });

    await archiveRange(jsonRequest(`http://localhost/api/admin/ranges/${created.id}/archive`, "POST"), idParams(created.id));

    const publicResponse = await publicRanges();
    const publicBody = await publicResponse.json();
    expect(publicBody.ranges.find((r: { id: string }) => r.id === created.id)).toBeUndefined();

    const adminResponse = await adminListRanges();
    const adminBody = await adminResponse.json();
    expect(adminBody.ranges.find((r: { id: string }) => r.id === created.id)).toBeDefined();

    const refreshed = await testDb.range.findUnique({ where: { id: created.id } });
    expect(refreshed?.archived).toBe(true);
  });

  it("unarchiving restores public visibility", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const created = await testDb.range.create({
      data: { name: `${TEST_RANGE_PREFIX}_f`, discipline: "Test", capacity: 6, archived: true },
    });

    await unarchiveRange(jsonRequest(`http://localhost/api/admin/ranges/${created.id}/unarchive`, "POST"), idParams(created.id));

    const publicResponse = await publicRanges();
    const publicBody = await publicResponse.json();
    expect(publicBody.ranges.find((r: { id: string }) => r.id === created.id)).toBeDefined();
  });
});

describe("update (Acceptance Criterion #13, Edge Case #9)", () => {
  it("updates capacity without touching anything else", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const created = await testDb.range.create({
      data: { name: `${TEST_RANGE_PREFIX}_g`, discipline: "Test", capacity: 6 },
    });

    const response = await updateRange(
      jsonRequest(`http://localhost/api/admin/ranges/${created.id}`, "PATCH", { capacity: 10 }),
      idParams(created.id),
    );
    expect(response.status).toBe(200);
    const updated = await testDb.range.findUnique({ where: { id: created.id } });
    expect(updated?.capacity).toBe(10);
    expect(updated?.name).toBe(created.name);
  });

  it("rejects renaming to a name that collides with a different range", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    await testDb.range.create({ data: { name: `${TEST_RANGE_PREFIX}_h1`, discipline: "Test", capacity: 6 } });
    const target = await testDb.range.create({ data: { name: `${TEST_RANGE_PREFIX}_h2`, discipline: "Test", capacity: 6 } });

    const response = await updateRange(
      jsonRequest(`http://localhost/api/admin/ranges/${target.id}`, "PATCH", { name: `${TEST_RANGE_PREFIX}_h1` }),
      idParams(target.id),
    );
    expect(response.status).toBe(409);
  });
});

describe("operating hours (PUT /api/admin/ranges/:id/hours)", () => {
  it("replaces the full week's schedule in one call", async () => {
    mockAuth.mockResolvedValue(ADMIN_SESSION);
    const created = await testDb.range.create({
      data: {
        name: `${TEST_RANGE_PREFIX}_i`,
        discipline: "Test",
        capacity: 6,
        operatingHours: { create: [{ dayOfWeek: 1, openTime: "09:00", closeTime: "10:00" }] },
      },
    });

    const response = await replaceHours(
      jsonRequest(`http://localhost/api/admin/ranges/${created.id}/hours`, "PUT", [
        { dayOfWeek: 3, openTime: "11:00", closeTime: "16:00" },
        { dayOfWeek: 5, openTime: "11:00", closeTime: "16:00" },
      ]),
      idParams(created.id),
    );
    expect(response.status).toBe(200);

    const hours = await testDb.rangeOperatingHours.findMany({ where: { rangeId: created.id } });
    expect(hours).toHaveLength(2);
    expect(hours.some((h) => h.dayOfWeek === 1)).toBe(false); // old Monday entry replaced, not appended
  });
});
