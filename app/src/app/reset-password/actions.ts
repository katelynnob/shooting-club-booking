"use server";

import { redirect } from "next/navigation";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";

export async function resetPasswordAction(_prevState: string | undefined, formData: FormData) {
  const response = await resetPasswordRoute(
    new Request("http://localhost/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: formData.get("token"),
        newPassword: formData.get("newPassword"),
      }),
    }),
  );

  if (!response.ok) {
    const body = await response.json();
    return body.error ?? "Could not reset password";
  }

  redirect("/login");
}
