import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { getRangeOrThrow } from "@/lib/ranges-repo";
import { toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Range management.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await getRangeOrThrow(id);
    const range = await db.range.update({ where: { id }, data: { archived: false } });
    return NextResponse.json({ range });
  } catch (error) {
    return toErrorResponse(error);
  }
}
