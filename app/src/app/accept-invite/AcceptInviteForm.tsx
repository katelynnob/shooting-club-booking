"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(acceptInviteAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <input type="hidden" name="token" value={token} />
      <label>
        Set your password
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
        {pending ? "Activating…" : "Activate account"}
      </button>
    </form>
  );
}
