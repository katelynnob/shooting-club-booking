import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Range management.
// Public — no auth required, but only non-archived ranges are ever visible
// here (Edge Case #10). Admin's equivalent (including archived) is
// GET /api/admin/ranges.
export async function GET() {
  try {
    const ranges = await db.range.findMany({
      where: { archived: false },
      include: { operatingHours: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ ranges });
  } catch (error) {
    return toErrorResponse(error);
  }
}
