import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/guards";
import { db } from "@/lib/db";
import { PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { toErrorResponse } from "@/lib/http-error";
import type { MemberStatus } from "@/generated/prisma/enums";

const VALID_STATUSES: MemberStatus[] = ["PENDING", "APPROVED", "REJECTED", "DEACTIVATED"];

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
// name/membershipNumber are always selected (not just for PENDING rows) —
// simpler than conditional field selection, and harmless to include always.
export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    if (statusParam && !VALID_STATUSES.includes(statusParam as MemberStatus)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const members = await db.user.findMany({
      where: statusParam ? { status: statusParam as MemberStatus } : undefined,
      select: PUBLIC_USER_SELECT,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ members });
  } catch (error) {
    return toErrorResponse(error);
  }
}
