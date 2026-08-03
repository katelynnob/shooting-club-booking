import { redirect } from "next/navigation";
import Image from "next/image";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/buttons/Button";
import { AdminNav } from "./AdminNav";

// Shared shell for every /admin/* route — sidebar nav + signed-in-as block.
// Mirrors ui_kits/admin/AdminApp.jsx, minus the role switch and
// bookings/coverage nav items (those land with specs 03/04).
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isAdmin && !session.user.isSuperAdmin) redirect("/dashboard");

  const initials = session.user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const roleLabel = [
    session.user.isSuperAdmin && "Super Admin",
    session.user.isAdmin && !session.user.isSuperAdmin && "Admin",
    session.user.isRso && "RSO",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--page-bg)" }}>
      <aside
        style={{
          width: 264,
          flex: "none",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-7)",
          padding: "var(--sp-7) var(--sp-6)",
          background: "var(--surface-card)",
          borderRight: "var(--border-w) solid var(--border-default)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
          <Image src="/logo.png" alt="" width={36} height={36} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ font: "var(--type-body-strong)", lineHeight: 1.2 }}>Harbour House</strong>
            <span className="hh-label">Range booking admin</span>
          </div>
        </div>

        <AdminNav />

        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <span className="hh-label">Signed in as</span>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--rx)",
                background: "var(--surface-inverse)",
                color: "var(--text-inverse)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "var(--type-body-strong)",
                fontSize: 13,
              }}
            >
              {initials}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <strong style={{ font: "var(--type-body-strong)", fontSize: "var(--fs-sm)" }}>{session.user.name}</strong>
              <span style={{ font: "var(--type-small)", fontSize: 12, color: "var(--text-muted)" }}>{roleLabel}</span>
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <Button type="submit" variant="ghost" size="sm" iconLeft="sign-out" fullWidth>
              Sign out
            </Button>
          </form>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          padding: "var(--sp-9)",
          maxWidth: "var(--max-w-admin)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-8)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
