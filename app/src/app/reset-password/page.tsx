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
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Reset password</h1>
      {token ? <ResetPasswordForm token={token} /> : <p style={{ color: "crimson" }}>Missing or invalid reset link.</p>}
    </main>
  );
}
