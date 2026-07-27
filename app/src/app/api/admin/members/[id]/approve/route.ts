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

    const target = await getUserOrThrow(id);
    if (target.status !== "PENDING") {
      throw new HttpError(409, "Only a pending member can be approved");
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: "APPROVED", approvedByUserId: session.user.id, approvedAt: new Date() },
      select: PUBLIC_USER_SELECT,
    });

    await sendEmail({ to: target.email, template: "member-approved", data: { name: target.name, loginUrl: "/login" } });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
