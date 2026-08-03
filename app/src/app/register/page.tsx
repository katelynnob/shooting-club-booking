"use client";

import { useActionState } from "react";
import { AuthShell } from "@/components/layout/AuthShell";
import { TextField } from "@/components/ui/forms/TextField";
import { PasswordField } from "@/components/ui/forms/PasswordField";
import { Button } from "@/components/ui/buttons/Button";
import { ButtonLink } from "@/components/ui/buttons/ButtonLink";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { registerAction } from "./actions";

export default function RegisterPage() {
  const [error, formAction, pending] = useActionState(registerAction, undefined);

  return (
    <AuthShell
      title="Apply for a member account"
      intro="An admin checks your membership number against the club's records before your account is activated."
    >
      <form action={formAction} style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <TextField id="name" name="name" label="Full name" required />
        <TextField id="email" name="email" label="Email address" type="email" required autoComplete="email" />
        <TextField
          id="membershipNumber"
          name="membershipNumber"
          label="Membership number"
          hint="As printed on your club card."
          required
        />
        <PasswordField
          id="password"
          name="password"
          hint="At least 8 characters."
          required
          minLength={8}
          autoComplete="new-password"
        />
        <InlineAlert tone="info" title="What happens next">
          Your application is reviewed by a club admin. You will receive an email once your account has been approved — you
          cannot book until then.
        </InlineAlert>
        <Button type="submit" size="lg" fullWidth iconLeft="paper-plane-tilt" loading={pending}>
          {pending ? "Registering…" : "Submit application"}
        </Button>
      </form>
      <ButtonLink href="/login" variant="ghost" fullWidth iconLeft="arrow-left">
        Back to sign in
      </ButtonLink>
    </AuthShell>
  );
}
