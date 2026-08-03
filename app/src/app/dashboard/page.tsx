import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { StatusBadge } from "@/components/ui/status/StatusBadge";
import { Button } from "@/components/ui/buttons/Button";
import { ButtonLink } from "@/components/ui/buttons/ButtonLink";

// Profile-tab pattern from ui_kits/member/MemberApp.jsx's ProfileScreen —
// the rest of that tab bar (Book / My bookings / Events) needs the booking
// backend from specs 02–06, not built yet, so this is deliberately just the
// one tab that already applies today.
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

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

  const rows: Array<[string, string]> = [
    ["Name", session.user.name],
    ["Email", session.user.email],
    ...(roleLabel ? ([["Roles", roleLabel]] as Array<[string, string]>) : []),
  ];

  return (
    <main
      style={{
        maxWidth: "var(--max-w-mobile)",
        margin: "0 auto",
        padding: "var(--sp-8) var(--gutter) var(--sp-10)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-7)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "var(--rx)",
            background: "var(--surface-inverse)",
            color: "var(--text-inverse)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "var(--type-h3)",
          }}
        >
          {initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          <strong style={{ font: "var(--type-h3)" }}>{session.user.name}</strong>
          <StatusBadge status={session.user.status} size="sm" />
        </div>
      </div>

      <div style={{ background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)", borderRadius: "var(--rx)" }}>
        {rows.map(([key, value], i) => (
          <div
            key={key}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--sp-5)",
              padding: "var(--sp-5) var(--sp-6)",
              borderBottom: i === rows.length - 1 ? "none" : "var(--border-w) solid var(--border-hairline)",
            }}
          >
            <span style={{ font: "var(--type-small)", color: "var(--text-muted)" }}>{key}</span>
            <span style={{ font: "var(--type-small)", fontSize: "var(--fs-sm)", color: "var(--text-body)" }}>{value}</span>
          </div>
        ))}
      </div>

      {(session.user.isAdmin || session.user.isSuperAdmin) && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <span className="hh-label">Admin</span>
          <ButtonLink href="/admin/members" variant="secondary" fullWidth iconLeft="users-three">
            Manage members
          </ButtonLink>
          <ButtonLink href="/admin/ranges" variant="secondary" fullWidth iconLeft="target">
            Manage ranges
          </ButtonLink>
        </div>
      )}

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="ghost" fullWidth iconLeft="sign-out">
          Sign out
        </Button>
      </form>
    </main>
  );
}
