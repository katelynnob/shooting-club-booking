import { db } from "@/lib/db";
import { HttpError } from "@/lib/http-error";

// Shared by every /api/admin/members/:id/* route — passwordHash must never
// be part of any API response, so every route builds its response from this
// shape rather than spreading a raw Prisma row.
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  membershipNumber: true,
  status: true,
  isRso: true,
  isAdmin: true,
  isSuperAdmin: true,
  approvedByUserId: true,
  approvedAt: true,
  rejectedReason: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getUserOrThrow(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw new HttpError(404, "Member not found");
  return user;
}
