import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forgotPasswordSchema } from "@/lib/validation/members";
import { issueInviteToken, issuePasswordResetToken } from "@/lib/account-tokens";
import { sendEmail } from "@/lib/email";
import { HttpError, toErrorResponse } from "@/lib/http-error";

const GENERIC_MESSAGE = "If an account exists for that email, a reset link has been sent.";

// specs/01-accounts-and-ranges.md, Behaviour: Password reset.
// Always the same response shape/timing-insensitive generic message,
// regardless of whether the email matches anything — Edge Case #14,
// Acceptance Criterion #14 (byte-for-byte identical response either way).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { email } = parsed.data;

    const user = await db.user.findUnique({ where: { email } });

    if (user) {
      if (user.passwordHash === null) {
        // Unaccepted invite — nothing to reset, reissue the invite instead.
        const rawToken = await issueInviteToken(user.id);
        await sendEmail({
          to: user.email,
          template: "invite",
          data: { name: user.name, inviteUrl: `/accept-invite?token=${rawToken}` },
        });
      } else {
        const rawToken = await issuePasswordResetToken(user.id);
        await sendEmail({
          to: user.email,
          template: "password-reset",
          data: { name: user.name, resetUrl: `/reset-password?token=${rawToken}` },
        });
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    return toErrorResponse(error);
  }
}
