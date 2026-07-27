import { db } from "@/lib/db";
import { HttpError } from "@/lib/http-error";

export async function getRangeOrThrow(id: string) {
  const range = await db.range.findUnique({ where: { id } });
  if (!range) throw new HttpError(404, "Range not found");
  return range;
}
