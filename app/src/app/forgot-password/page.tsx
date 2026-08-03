"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { TextField } from "@/components/ui/forms/TextField";
import { Button } from "@/components/ui/buttons/Button";
import { ButtonLink } from "@/components/ui/buttons/ButtonLink";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { forgotPasswordAction } from "./actions";

export default function ForgotPasswordPage() {
  const [message, formAction, pending] = useActionState(forgotPasswordAction, undefined);

  return (
    <AuthShell title="Forgot password" intro="Enter your email and we'll send a reset link if an account exists.">
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        {message && <InlineAlert tone="success">{message}</InlineAlert>}
        <TextField id="email" name="email" label="Email address" type="email" required autoComplete="email" />
        <Button type="submit" size="lg" fullWidth iconLeft="paper-plane-tilt" loading={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <ButtonLink href="/login" variant="ghost" fullWidth iconLeft="arrow-left">
        Back to sign in
      </ButtonLink>
    </AuthShell>
  );
}
