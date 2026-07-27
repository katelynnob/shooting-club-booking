"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <main style={{ maxWidth: 320, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Log in</h1>
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" style={{ display: "block", width: "100%" }} />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            style={{ display: "block", width: "100%" }}
          />
        </label>
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </button>
      </form>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        <Link href="/forgot-password">Forgot password?</Link>
        {" · "}
        <Link href="/register">Register</Link>
      </p>
    </main>
  );
}
