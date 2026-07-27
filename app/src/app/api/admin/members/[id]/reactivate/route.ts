import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { getUserOrThrow, PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const target = await getUserOrThrow(id);
    if (target.status !== "DEACTIVATED") {
      throw new HttpError(409, "Only a deactivated member can be reactivated");
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: "APPROVED" },
      select: PUBLIC_USER_SELECT,
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
