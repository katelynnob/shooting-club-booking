import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// Standard singleton pattern: Next.js dev-mode hot-reload re-evaluates this
// module on every change, which would otherwise create a new PrismaClient
// (and a new pg connection pool) on every save. Stash it on `globalThis` so
// dev reuses the same instance; production just gets a fresh one per process.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
