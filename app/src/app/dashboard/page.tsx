import { redirect } from "next/navigation";
import Link from "next/link";
import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main style={{ maxWidth: 480, margin: "4rem auto", fontFamily: "sans-serif" }}>
      <h1>Welcome, {session.user.email}</h1>
      <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: 4 }}>
        {JSON.stringify(session.user, null, 2)}
      </pre>
      {(session.user.isAdmin || session.user.isSuperAdmin) && (
        <p>
          <Link href="/admin/members">Manage members</Link>
          {" · "}
          <Link href="/admin/ranges">Manage ranges</Link>
        </p>
      )}
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
