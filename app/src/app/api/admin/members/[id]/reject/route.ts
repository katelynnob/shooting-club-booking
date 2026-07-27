import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { rejectMemberSchema } from "@/lib/validation/members";
import { getUserOrThrow, PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { sendEmail } from "@/lib/email";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const parsed = rejectMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const target = await getUserOrThrow(id);
    if (target.status !== "PENDING") {
      throw new HttpError(409, "Only a pending member can be rejected");
    }

    const updated = await db.user.update({
      where: { id },
      data: { status: "REJECTED", rejectedReason: parsed.data.rejectedReason },
      select: PUBLIC_USER_SELECT,
    });

    // rejectedReason is never included here — internal record only, never
    // shown to the applicant (spec 01, Edge Case #19 / member-rejected template).
    await sendEmail({ to: target.email, template: "member-rejected", data: { name: target.name, loginUrl: "/login" } });

    return NextResponse.json({ member: updated });
  } catch (error) {
    return toErrorResponse(error);
  }
}
