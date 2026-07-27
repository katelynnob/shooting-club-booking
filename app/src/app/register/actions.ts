"use server";

import { redirect } from "next/navigation";
import { POST as registerRoute } from "@/app/api/auth/register/route";

// Calls the real route handler in-process (no network hop) so this page and
// the API contract can never drift apart — same pattern used throughout
// tests/integration/.
export async function registerAction(_prevState: string | undefined, formData: FormData) {
  const response = await registerRoute(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
        name: formData.get("name"),
        membershipNumber: formData.get("membershipNumber"),
      }),
    }),
  );

  if (!response.ok) {
    const body = await response.json();
    return body.error ?? "Registration failed";
  }

  redirect("/register/pending");
}
