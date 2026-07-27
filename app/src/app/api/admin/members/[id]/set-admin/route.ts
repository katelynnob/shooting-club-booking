import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { setAdminSchema } from "@/lib/validation/members";
import { getUserOrThrow, PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Super Admin.
// Gated by requireSuperAdmin, NOT requireAdmin — a regular Admin gets 403
// here even though they can reach every other /api/admin/* route
// (Edge Case #4, Acceptance Criterion #6).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = setAdminSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await getUserOrThrow(id);

    const updated = await db.user.update({
      where: { id },
      data: { isAdmin: parsed.data.isAdmin },
      select: PUBLIC_USER_SELECT,
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
