import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { db } from "@/lib/db";
import { registerSchema } from "@/lib/validation/members";
import { HttpError, toErrorResponse } from "@/lib/http-error";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

// specs/01-accounts-and-ranges.md, Behaviour: Registration.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { email, password, name, membershipNumber } = parsed.data;

    // Checked up front for a clean error message; the create() below is
    // still guarded against a concurrent-registration race via the schema's
    // unique constraints (Edge Cases #1, #27).
    const existingEmail = await db.user.findUnique({ where: { email } });
    if (existingEmail) throw new HttpError(409, "An account with this email already exists");

    const existingMembership = await db.user.findUnique({ where: { membershipNumber } });
    if (existingMembership) throw new HttpError(409, "This membership number is already registered");

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: { email, passwordHash, name, membershipNumber, status: "PENDING" },
    });

    return NextResponse.json({ id: user.id, email: user.email, status: user.status }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json({ error: "An account with this email or membership number already exists" }, { status: 409 });
    }
    return toErrorResponse(error);
  }
}
