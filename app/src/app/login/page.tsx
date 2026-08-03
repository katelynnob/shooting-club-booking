"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { TextField } from "@/components/ui/forms/TextField";
import { PasswordField } from "@/components/ui/forms/PasswordField";
import { Button } from "@/components/ui/buttons/Button";
import { ButtonLink } from "@/components/ui/buttons/ButtonLink";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(loginAction, undefined);

  return (
    <AuthShell title="Harbour House range booking" intro="Sign in to book a range slot.">
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <TextField id="email" name="email" label="Email address" type="email" required autoComplete="email" />
        <PasswordField id="password" name="password" required autoComplete="current-password" />
        <Button type="submit" size="lg" fullWidth iconLeft="sign-in" loading={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
        <a href="/forgot-password" style={{ font: "var(--type-small)", textAlign: "center" }}>
          Forgotten your password?
        </a>
      </form>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-5)",
          paddingTop: "var(--sp-6)",
          borderTop: "var(--border-w) solid var(--border-hairline)",
        }}
      >
        <ButtonLink href="/register" variant="secondary" size="lg" fullWidth iconLeft="user-plus">
          Apply for a member account
        </ButtonLink>
      </div>
    </AuthShell>
  );
}
