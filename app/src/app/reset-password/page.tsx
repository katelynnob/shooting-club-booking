import { AuthShell } from "@/components/layout/AuthShell";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { ResetPasswordForm } from "./ResetPasswordForm";

// Next.js 16: searchParams is async — see GETTING_STARTED.md's note on
// async request-time APIs.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthShell title="Reset password">
      {token ? <ResetPasswordForm token={token} /> : <InlineAlert tone="danger">Missing or invalid reset link.</InlineAlert>}
    </AuthShell>
  );
}
