"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/forms/TextField";
import { Button } from "@/components/ui/buttons/Button";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { inviteAction } from "./actions";

export function InviteForm() {
  const [error, formAction, pending] = useActionState(inviteAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", gap: "var(--sp-5)", alignItems: "flex-end", flexWrap: "wrap" }}>
      <TextField id="invite-name" name="name" label="Name" required style={{ minWidth: 160 }} />
      <TextField id="invite-email" name="email" label="Email" type="email" required style={{ minWidth: 200 }} />
      <TextField id="invite-membershipNumber" name="membershipNumber" label="Membership #" required style={{ minWidth: 140 }} />
      <Button type="submit" iconLeft="user-plus" loading={pending}>
        {pending ? "Inviting…" : "Invite member"}
      </Button>
      {error && (
        <InlineAlert tone="danger" style={{ width: "100%" }}>
          {error}
        </InlineAlert>
      )}
    </form>
  );
}
