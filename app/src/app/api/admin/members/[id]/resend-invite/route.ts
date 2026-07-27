import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { getUserOrThrow } from "@/lib/members-repo";
import { issueInviteToken } from "@/lib/account-tokens";
import { sendEmail } from "@/lib/email";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Admin-invited accounts.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const target = await getUserOrThrow(id);

    // Edge Case #24: nothing to resend once the account already has a
    // password — this isn't a way to force a password reset.
    if (target.passwordHash !== null) {
      throw new HttpError(409, "This account has already been activated — nothing to resend");
    }

    const rawToken = await issueInviteToken(target.id);
    await sendEmail({
      to: target.email,
      template: "invite",
      data: { name: target.name, inviteUrl: `/accept-invite?token=${rawToken}` },
    });

    return NextResponse.json({ message: "Invite resent" });
  } catch (error) {
    return toErrorResponse(error);
  }
}
