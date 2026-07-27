import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { updateRangeSchema } from "@/lib/validation/ranges";
import { getRangeOrThrow } from "@/lib/ranges-repo";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

// specs/01-accounts-and-ranges.md, Behaviour: Range management.
// Edits apply prospectively only — nothing here attempts any retroactive
// write against historical data (Edge Case #9); there's nothing to touch
// yet since ad-hoc booking doesn't exist in this spec.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = updateRangeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await getRangeOrThrow(id);

    if (parsed.data.name) {
      const conflict = await db.range.findFirst({
        where: { name: { equals: parsed.data.name, mode: "insensitive" } },
      });
      if (conflict && conflict.id !== id) throw new HttpError(409, "A range with this name already exists");
    }

    const range = await db.range.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ range });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "A range with this name already exists" }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}
