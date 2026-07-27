"use server";

import { revalidatePath } from "next/cache";
import { POST as createRangeRoute } from "@/app/api/admin/ranges/route";
import { PATCH as updateRangeRoute } from "@/app/api/admin/ranges/[id]/route";
import { POST as archiveRoute } from "@/app/api/admin/ranges/[id]/archive/route";
import { POST as unarchiveRoute } from "@/app/api/admin/ranges/[id]/unarchive/route";

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function request(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function runAndRevalidate(response: Promise<Response>) {
  const result = await response;
  revalidatePath("/admin/ranges");
  if (!result.ok) {
    const body = await result.json().catch(() => ({}));
    return body.error ?? "Action failed";
  }
  return undefined;
}

export async function createRangeAction(_prevState: string | undefined, formData: FormData) {
  return runAndRevalidate(
    createRangeRoute(
      request("POST", "/api/admin/ranges", {
        name: formData.get("name"),
        discipline: formData.get("discipline"),
        capacity: Number(formData.get("capacity")),
      }),
    ),
  );
}

export async function updateCapacityAction(formData: FormData) {
  const id = formData.get("id") as string;
  const capacity = Number(formData.get("capacity"));
  await runAndRevalidate(updateRangeRoute(request("PATCH", `/api/admin/ranges/${id}`, { capacity }), idParams(id)));
}

export async function archiveAction(formData: FormData) {
  const id = formData.get("id") as string;
  await runAndRevalidate(archiveRoute(request("POST", `/api/admin/ranges/${id}/archive`), idParams(id)));
}

export async function unarchiveAction(formData: FormData) {
  const id = formData.get("id") as string;
  await runAndRevalidate(unarchiveRoute(request("POST", `/api/admin/ranges/${id}/unarchive`), idParams(id)));
}
