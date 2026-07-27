import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { db } from "@/lib/db";
import { resetPasswordSchema } from "@/lib/validation/members";
import { consumeToken } from "@/lib/account-tokens";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Password reset.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { token, newPassword } = parsed.data;

    const consumed = await consumeToken(token, "PASSWORD_RESET");
    if (!consumed) throw new HttpError(400, "Invalid or expired link");

    const passwordHash = await hashPassword(newPassword);

    // sessionVersion increment is the whole point — see specs/01's Session
    // strategy section: this is what forces every existing token to stop
    // matching on its next use (Edge Case #17, Acceptance Criterion #16).
    await db.user.update({
      where: { id: consumed.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    return NextResponse.json({ message: "Password updated" });
  } catch (error) {
    return toErrorResponse(error);
  }
}
