import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { createRangeSchema } from "@/lib/validation/ranges";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

// specs/01-accounts-and-ranges.md, Behaviour: Range management.
export async function GET() {
  try {
    await requireAdmin();
    const ranges = await db.range.findMany({
      include: { operatingHours: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ranges });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json().catch(() => null);
    const parsed = createRangeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    // Edge Case #8: case-insensitive name uniqueness. This pre-check has a
    // narrow concurrent-creation race window (the schema's own @unique
    // constraint is case-sensitive) — accepted as a low-risk tradeoff for a
    // rare, admin-only action, unlike the concurrency-critical booking paths
    // in specs/04-slots-booking-and-blackouts.md.
    const existing = await db.range.findFirst({
      where: { name: { equals: parsed.data.name, mode: "insensitive" } },
    });
    if (existing) throw new HttpError(409, "A range with this name already exists");

    const range = await db.range.create({ data: parsed.data });
    return NextResponse.json({ range }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A range with this name already exists" }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}
