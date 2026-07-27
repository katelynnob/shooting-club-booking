"use server";

import { redirect } from "next/navigation";
import { POST as acceptInviteRoute } from "@/app/api/auth/accept-invite/route";

export async function acceptInviteAction(_prevState: string | undefined, formData: FormData) {
  const response = await acceptInviteRoute(
    new Request("http://localhost/api/auth/accept-invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: formData.get("token"),
        password: formData.get("password"),
      }),
    }),
  );

  if (!response.ok) {
    const body = await response.json();
    return body.error ?? "Could not activate account";
  }

  // Accepting an invite logs the member straight in (spec 01, AC #23) — no
  // separate login step.
  redirect("/dashboard");
}
