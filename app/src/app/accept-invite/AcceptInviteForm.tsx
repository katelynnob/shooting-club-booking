"use client";

import { useActionState } from "react";
import { PasswordField } from "@/components/ui/forms/PasswordField";
import { Button } from "@/components/ui/buttons/Button";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { acceptInviteAction } from "./actions";

export function AcceptInviteForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(acceptInviteAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <input type="hidden" name="token" value={token} />
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      <PasswordField
        id="password"
        name="password"
        label="Set your password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      <Button type="submit" size="lg" fullWidth iconLeft="check" loading={pending}>
        {pending ? "Activating…" : "Activate account"}
      </Button>
    </form>
  );
}
