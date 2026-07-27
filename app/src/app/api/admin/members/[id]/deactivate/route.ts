import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { getUserOrThrow, PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { sendEmail } from "@/lib/email";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    // Edge Case #5: the Super Admin's account can never be deactivated by
    // anyone, including themselves. Checked before the self-deactivation
    // check below so the more specific "you can't touch the Super Admin at
    // all" reason isn't masked by the generic self-lockout one.
    const target = await getUserOrThrow(id);
    if (target.isSuperAdmin) {
      throw new HttpError(403, "The Super Admin's account cannot be deactivated");
    }

    // Edge Case #6: a regular Admin can't deactivate their own account —
    // prevents accidental self-lockout mid-session.
    if (target.id === session.user.id) {
      throw new HttpError(403, "You cannot deactivate your own account");
    }

    if (target.status !== "APPROVED") {
      throw new HttpError(409, "Only an approved member can be deactivated");
    }

    // sessionVersion increment is what revokes access immediately (specs/01,
    // Session strategy) — their existing JWT stops matching on its very next
    // request, regardless of how far from expiry it is.
    const updated = await db.user.update({
      where: { id },
      data: { status: "DEACTIVATED", sessionVersion: { increment: 1 } },
      select: PUBLIC_USER_SELECT,
    });

    await sendEmail({ to: target.email, template: "member-deactivated", data: { name: target.name, loginUrl: "/login" } });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
