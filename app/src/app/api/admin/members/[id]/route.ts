import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { patchMemberSchema } from "@/lib/validation/members";
import { getUserOrThrow, PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
// Lets admin correct a typo'd membership number/name/email spotted during
// the membership-sheet cross-check, without requiring the member to
// re-register (Edge Case #20).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => null);
    const parsed = patchMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    await getUserOrThrow(id);

    // Same uniqueness rules as registration — checked explicitly (excluding
    // this row) for a clean error, on top of the schema-level unique
    // constraint as a concurrency fallback.
    if (parsed.data.email) {
      const conflict = await db.user.findUnique({ where: { email: parsed.data.email } });
      if (conflict && conflict.id !== id) throw new HttpError(409, "An account with this email already exists");
    }
    if (parsed.data.membershipNumber) {
      const conflict = await db.user.findUnique({ where: { membershipNumber: parsed.data.membershipNumber } });
      if (conflict && conflict.id !== id) throw new HttpError(409, "This membership number is already registered");
    }

    const updated = await db.user.update({
      where: { id },
      data: parsed.data,
      select: PUBLIC_USER_SELECT,
    });

    return NextResponse.json({ member: updated });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "An account with this email or membership number already exists" }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}
