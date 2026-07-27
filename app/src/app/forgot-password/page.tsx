"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [message, formAction, pending] = useActionState(forgotPasswordAction, undefined);

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Forgot password</h1>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" style={{ display: "block", width: "100%" }} />
        </label>
        {message && <p>{message}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>
    </main>
  );
}
