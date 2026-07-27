"use server";

import { revalidatePath } from "next/cache";
import { POST as approveRoute } from "@/app/api/admin/members/[id]/approve/route";
import { POST as rejectRoute } from "@/app/api/admin/members/[id]/reject/route";
import { POST as deactivateRoute } from "@/app/api/admin/members/[id]/deactivate/route";
import { POST as reactivateRoute } from "@/app/api/admin/members/[id]/reactivate/route";
import { POST as setRsoRoute } from "@/app/api/admin/members/[id]/set-rso/route";
import { POST as setAdminRoute } from "@/app/api/admin/members/[id]/set-admin/route";
import { POST as resendInviteRoute } from "@/app/api/admin/members/[id]/resend-invite/route";
import { PATCH as patchMemberRoute } from "@/app/api/admin/members/[id]/route";
import { POST as inviteRoute } from "@/app/api/admin/members/invite/route";

function idParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function post(path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function runAndRevalidate(response: Promise<Response>) {
  const result = await response;
  revalidatePath("/admin/members");
  if (!result.ok) {
    const body = await result.json().catch(() => ({}));
    return body.error ?? "Action failed";
  }
  return undefined;
}

export async function approveAction(formData: FormData) {
  const id = formData.get("id") as string;
  await runAndRevalidate(approveRoute(post(`/api/admin/members/${id}/approve`), idParams(id)));
}

export async function rejectAction(formData: FormData) {
  const id = formData.get("id") as string;
  const rejectedReason = formData.get("rejectedReason") as string | null;
  await runAndRevalidate(
    rejectRoute(post(`/api/admin/members/${id}/reject`, { rejectedReason: rejectedReason || undefined }), idParams(id)),
  );
}

export async function deactivateAction(formData: FormData) {
  const id = formData.get("id") as string;
  await runAndRevalidate(deactivateRoute(post(`/api/admin/members/${id}/deactivate`), idParams(id)));
}

export async function reactivateAction(formData: FormData) {
  const id = formData.get("id") as string;
  await runAndRevalidate(reactivateRoute(post(`/api/admin/members/${id}/reactivate`), idParams(id)));
}

export async function setRsoAction(formData: FormData) {
  const id = formData.get("id") as string;
  const isRso = formData.get("isRso") === "true";
  await runAndRevalidate(setRsoRoute(post(`/api/admin/members/${id}/set-rso`, { isRso }), idParams(id)));
}

export async function setAdminAction(formData: FormData) {
  const id = formData.get("id") as string;
  const isAdmin = formData.get("isAdmin") === "true";
  await runAndRevalidate(setAdminRoute(post(`/api/admin/members/${id}/set-admin`, { isAdmin }), idParams(id)));
}

export async function resendInviteAction(formData: FormData) {
  const id = formData.get("id") as string;
  await runAndRevalidate(resendInviteRoute(post(`/api/admin/members/${id}/resend-invite`), idParams(id)));
}

export async function patchMemberAction(formData: FormData) {
  const id = formData.get("id") as string;
  const name = formData.get("name") as string;
  const membershipNumber = formData.get("membershipNumber") as string;
  await runAndRevalidate(
    patchMemberRoute(post(`/api/admin/members/${id}`, { name, membershipNumber }), idParams(id)),
  );
}

export async function inviteAction(_prevState: string | undefined, formData: FormData) {
  const response = await inviteRoute(
    post("/api/admin/members/invite", {
      email: formData.get("email"),
      name: formData.get("name"),
      membershipNumber: formData.get("membershipNumber"),
    }),
  );
  revalidatePath("/admin/members");
  if (!response.ok) {
    const body = await response.json();
    return body.error ?? "Invite failed";
  }
  return undefined;
}
