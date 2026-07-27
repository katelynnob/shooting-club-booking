// Duck-typed check, deliberately not importing Prisma's specific error class —
// works regardless of the exact generated-client export shape (see the
// Prisma 7 generator notes in ../GETTING_STARTED.md for why that's worth
// being defensive about).
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
