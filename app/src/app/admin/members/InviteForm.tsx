"use client";

import { useActionState } from "react";
import { inviteAction } from "./actions";

export function InviteForm() {
  const [error, formAction, pending] = useActionState(inviteAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      <label>
        Name
        <input name="name" required style={{ display: "block" }} />
      </label>
      <label>
        Email
        <input name="email" type="email" required style={{ display: "block" }} />
      </label>
      <label>
        Membership #
        <input name="membershipNumber" required style={{ display: "block" }} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Inviting…" : "Invite member"}
      </button>
      {error && <p style={{ color: "crimson", width: "100%" }}>{error}</p>}
    </form>
  );
}
