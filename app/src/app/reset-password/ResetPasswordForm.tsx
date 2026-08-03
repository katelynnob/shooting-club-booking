"use client";

import { useActionState } from "react";
import { PasswordField } from "@/components/ui/forms/PasswordField";
import { Button } from "@/components/ui/buttons/Button";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { resetPasswordAction } from "./actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, formAction, pending] = useActionState(resetPasswordAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <input type="hidden" name="token" value={token} />
      {error && <InlineAlert tone="danger">{error}</InlineAlert>}
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="New password"
        required
        minLength={8}
        autoComplete="new-password"
      />
      <Button type="submit" size="lg" fullWidth iconLeft="check" loading={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
