import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { InviteForm } from "./InviteForm";
import { MembersTable } from "./MembersTable";

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
// Auth/role gating lives in app/admin/layout.tsx; session is re-fetched here
// only for the super-admin-only "Grant/Revoke Admin" distinction.
export default async function AdminMembersPage() {
  const session = await auth();
  const members = await db.user.findMany({ select: PUBLIC_USER_SELECT, orderBy: { createdAt: "asc" } });
  const pendingCount = members.filter((m) => m.status === "PENDING").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <h1 style={{ font: "var(--type-h1)" }}>Members</h1>
        <p style={{ font: "var(--type-small)", color: "var(--text-muted)" }}>
          Approve applications by cross-checking the membership number against the club&apos;s records.
        </p>
      </div>

      {pendingCount > 0 && (
        <InlineAlert tone="warning" title={`${pendingCount} application${pendingCount === 1 ? "" : "s"} awaiting approval`}>
          Applicants cannot book until an admin approves them. Rejection reasons are recorded internally and never shown to
          the applicant.
        </InlineAlert>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--sp-5)",
          background: "var(--surface-card)",
          border: "var(--border-w) solid var(--border-default)",
          borderRadius: "var(--rx)",
          padding: "var(--sp-6)",
        }}
      >
        <span className="hh-label">Invite a member directly</span>
        <InviteForm />
      </div>

      <MembersTable members={members} isSuperAdmin={!!session?.user.isSuperAdmin} currentUserId={session!.user.id} />
    </div>
  );
}
