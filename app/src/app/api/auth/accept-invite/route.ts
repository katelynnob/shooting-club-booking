import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { db } from "@/lib/db";
import { acceptInviteSchema } from "@/lib/validation/members";
import { consumeToken } from "@/lib/account-tokens";
import { signIn } from "@/auth";
import { HttpError, toErrorResponse } from "@/lib/http-error";

// specs/01-accounts-and-ranges.md, Behaviour: Admin-invited accounts.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = acceptInviteSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { token, password } = parsed.data;

    const consumed = await consumeToken(token, "INVITE");
    if (!consumed) throw new HttpError(400, "Invalid or expired invite link");

    const passwordHash = await hashPassword(password);
    const user = await db.user.update({
      where: { id: consumed.userId },
      data: { passwordHash },
    });

    // Unlike password reset, there's no prior session to force out — accepting
    // an invite should log the member straight in, not require a separate
    // login step right after (spec 01, Acceptance Criterion #23). Re-runs the
    // same Credentials authorize() flow rather than a bespoke "trust me"
    // session-creation path.
    await signIn("credentials", { email: user.email, password, redirect: false });

    return NextResponse.json({ message: "Account activated" });
  } catch (error) {
    return toErrorResponse(error);
  }
}
