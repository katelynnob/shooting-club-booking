import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { inviteMemberSchema } from "@/lib/validation/members";
import { issueInviteToken } from "@/lib/account-tokens";
import { sendEmail } from "@/lib/email";
import { PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

// specs/01-accounts-and-ranges.md, Behaviour: Admin-invited accounts.
export async function POST(request: Request) {
  try {
    const session = await requireAdmin();

    const body = await request.json().catch(() => null);
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { email, name, membershipNumber } = parsed.data;

    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) throw new HttpError(409, "An account with this email already exists");

    const existingMembership = await db.user.findUnique({ where: { membershipNumber } });
    if (existingMembership) throw new HttpError(409, "This membership number is already registered");

    // status = APPROVED immediately, passwordHash = null — admin creating
    // this directly *is* the verification, same audit fields as approve().
    const user = await db.user.create({
      data: {
        email,
        name,
        membershipNumber,
        status: "APPROVED",
        passwordHash: null,
        approvedByUserId: session.user.id,
        approvedAt: new Date(),
      },
      select: PUBLIC_USER_SELECT,
    });

    const rawToken = await issueInviteToken(user.id);
    await sendEmail({
      to: email,
      template: "invite",
      data: { name, inviteUrl: `/accept-invite?token=${rawToken}` },
    });

    return NextResponse.json({ member: user }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "An account with this email or membership number already exists" }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}
