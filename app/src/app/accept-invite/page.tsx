import { AuthShell } from "@/components/layout/AuthShell";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell title="Activate your account" intro="Set a password to activate your account and sign in.">
      {token ? <AcceptInviteForm token={token} /> : <InlineAlert tone="danger">Missing or invalid invite link.</InlineAlert>}
    </AuthShell>
  );
}
