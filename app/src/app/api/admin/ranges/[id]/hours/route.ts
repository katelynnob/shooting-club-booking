import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { replaceRangeHoursSchema } from "@/lib/validation/ranges";
import { getRangeOrThrow } from "@/lib/ranges-repo";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Range management. Replaces the
// full 7-day schedule in one call — simpler than per-day PATCHes, and a
// schedule change is naturally an all-at-once edit.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = replaceRangeHoursSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await getRangeOrThrow(id);

    const operatingHours = await db.$transaction(async (tx) => {
      await tx.rangeOperatingHours.deleteMany({ where: { rangeId: id } });
      if (parsed.data.length === 0) return [];
      await tx.rangeOperatingHours.createMany({
        data: parsed.data.map((entry) => ({ ...entry, rangeId: id })),
      });
      return tx.rangeOperatingHours.findMany({ where: { rangeId: id }, orderBy: { dayOfWeek: "asc" } });
    });

    return NextResponse.json({ operatingHours });
  } catch (error) {
    return toErrorResponse(error);
  }
}
