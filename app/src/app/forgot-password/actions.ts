"use server";

import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";

export async function forgotPasswordAction(_prevState: string | undefined, formData: FormData) {
  const response = await forgotPasswordRoute(
    new Request("http://localhost/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email") }),
    }),
  );
  const body = await response.json();
  // Always the same generic message either way — see specs/01-accounts-and-ranges.md.
  return body.message ?? body.error ?? "If an account exists for that email, a reset link has been sent.";
}
