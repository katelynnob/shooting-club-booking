"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <input type="hidden" name="token" value={token} />
      <label>
        New password
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          style={{ display: "block", width: "100%" }}
        />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
