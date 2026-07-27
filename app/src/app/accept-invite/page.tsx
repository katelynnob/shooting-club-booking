import { AcceptInviteForm } from "./AcceptInviteForm";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main style={{ maxWidth: 360, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Activate your account</h1>
      {token ? <AcceptInviteForm token={token} /> : <p style={{ color: "crimson" }}>Missing or invalid invite link.</p>}
    </main>
  );
}
