"use client";

import { useActionState } from "react";
import { registerAction } from "./actions";

export default function RegisterPage() {
  const [error, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Register</h1>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        Your account will be pending admin approval — you won&apos;t be able to log in until then.
      </p>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Name
          <input name="name" required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Membership number
          <input name="membershipNumber" required style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            style={{ display: "block", width: "100%" }}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Registering…" : "Register"}
        </button>
      </form>
    </main>
  );
}
