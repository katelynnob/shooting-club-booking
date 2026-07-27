import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { setRsoSchema } from "@/lib/validation/members";
import { getUserOrThrow, PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
// Any status is allowed — Edge Case #11: the flag can be set ahead of
// approval/reactivation so it's ready the moment the account is APPROVED.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = setRsoSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await getUserOrThrow(id);

    const updated = await db.user.update({
      where: { id },
      data: { isRso: parsed.data.isRso },
      select: PUBLIC_USER_SELECT,
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
