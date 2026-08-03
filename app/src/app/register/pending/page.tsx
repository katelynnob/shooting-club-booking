import { AuthShell } from "@/components/layout/AuthShell";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { ButtonLink } from "@/components/ui/buttons/ButtonLink";

export default function RegisterPendingPage() {
  return (
    <AuthShell title="Application received">
      <InlineAlert tone="warning" title="Awaiting admin approval" icon="hourglass-high">
        Thank you. A club admin will cross-check your membership number against the club&apos;s records and email you when
        your account is active. Applications are usually reviewed within a few days.
      </InlineAlert>
      <ButtonLink href="/login" variant="secondary" size="lg" fullWidth iconLeft="arrow-left">
        Back to sign in
      </ButtonLink>
    </AuthShell>
  );
}
