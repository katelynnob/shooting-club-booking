// One-time deployment bootstrap — specs/01-accounts-and-ranges.md, "Super
// Admin": exactly one user has isSuperAdmin = true, created this way, never
// through the app itself. Idempotent (safe to re-run; no-ops if the account
// already exists) and deliberately reuses the invite mechanism (passwordHash
// starts null, an INVITE token is issued) rather than a bespoke
// "set an initial password" path — there's no inviting admin to email this
// to, so the accept-invite URL is printed to the console instead.
//
// Run with: SUPER_ADMIN_EMAIL=you@example.com npx tsx prisma/bootstrap-super-admin.ts

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { generateRawToken, hashToken, INVITE_TOKEN_TTL_MS } from "../src/lib/tokens";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error("SUPER_ADMIN_EMAIL env var is required.");
  }

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super Admin already exists for ${email} (id: ${existing.id}) — nothing to do.`);
    await db.$disconnect();
    return;
  }

  const existingSuperAdmin = await db.user.findFirst({ where: { isSuperAdmin: true } });
  if (existingSuperAdmin) {
    throw new Error(
      `A Super Admin already exists (${existingSuperAdmin.email}) — there can only be exactly one. ` +
        "Changing who holds it is a deliberate manual DB action, not something this script does.",
    );
  }

  const user = await db.user.create({
    data: {
      email,
      name: "Super Admin",
      // Synthetic value — the Super Admin is a deployment-level account, not
      // necessarily a real club member cross-referenced against the
      // membership sheet, but the field is required+unique at the schema level.
      membershipNumber: `SUPERADMIN-${Date.now()}`,
      status: "APPROVED",
      passwordHash: null,
      isSuperAdmin: true,
      approvedAt: new Date(),
    },
  });

  const rawToken = generateRawToken();
  await db.accountToken.create({
    data: {
      userId: user.id,
      purpose: "INVITE",
      tokenHash: hashToken(rawToken),
      expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
    },
  });

  console.log(`Super Admin created: ${email}`);
  console.log(`Set their password at: /accept-invite?token=${rawToken}`);
  console.log("(This link expires in 7 days — re-run this script to issue a new one if needed, as long as the account still has no password set.)");

  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
