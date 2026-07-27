import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PUBLIC_USER_SELECT } from "@/lib/members-repo";
import { InviteForm } from "./InviteForm";
import {
  approveAction,
  deactivateAction,
  patchMemberAction,
  reactivateAction,
  rejectAction,
  resendInviteAction,
  setAdminAction,
  setRsoAction,
} from "./actions";

// specs/01-accounts-and-ranges.md, Behaviour: Admin member management.
// Deliberately minimal — the spec's own "Out of Scope" section calls out
// "Admin UI polish beyond functional CRUD" as not this spec's concern.
export default async function AdminMembersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isAdmin && !session.user.isSuperAdmin) redirect("/dashboard");

  const members = await db.user.findMany({ select: PUBLIC_USER_SELECT, orderBy: { createdAt: "asc" } });
  const isSuperAdmin = session.user.isSuperAdmin;

  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Members</h1>

      <h2 style={{ fontSize: "1rem" }}>Invite a new member directly</h2>
      <InviteForm />

      <table style={{ width: "100%", marginTop: "2rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Name</th>
            <th>Email</th>
            <th>Membership #</th>
            <th>Status</th>
            <th>Roles</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{member.name}</td>
              <td>{member.email}</td>
              <td>{member.membershipNumber}</td>
              <td>{member.status}</td>
              <td>
                {member.isSuperAdmin ? "Super Admin " : ""}
                {member.isAdmin ? "Admin " : ""}
                {member.isRso ? "RSO" : ""}
              </td>
              <td>
                <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  {member.status === "PENDING" && (
                    <>
                      <form action={approveAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <button type="submit">Approve</button>
                      </form>
                      <form action={rejectAction}>
                        <input type="hidden" name="id" value={member.id} />
                        <button type="submit">Reject</button>
                      </form>
                    </>
                  )}
                  {member.status === "APPROVED" && !member.isSuperAdmin && member.id !== session.user.id && (
                    <form action={deactivateAction}>
                      <input type="hidden" name="id" value={member.id} />
                      <button type="submit">Deactivate</button>
                    </form>
                  )}
                  {member.status === "DEACTIVATED" && (
                    <form action={reactivateAction}>
                      <input type="hidden" name="id" value={member.id} />
                      <button type="submit">Reactivate</button>
                    </form>
                  )}
                  <form action={setRsoAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <input type="hidden" name="isRso" value={(!member.isRso).toString()} />
                    <button type="submit">{member.isRso ? "Revoke RSO" : "Grant RSO"}</button>
                  </form>
                  {isSuperAdmin && (
                    <form action={setAdminAction}>
                      <input type="hidden" name="id" value={member.id} />
                      <input type="hidden" name="isAdmin" value={(!member.isAdmin).toString()} />
                      <button type="submit">{member.isAdmin ? "Revoke Admin" : "Grant Admin"}</button>
                    </form>
                  )}
                  <form action={resendInviteAction}>
                    <input type="hidden" name="id" value={member.id} />
                    <button type="submit">Resend invite</button>
                  </form>
                  <form action={patchMemberAction} style={{ display: "flex", gap: "0.25rem" }}>
                    <input type="hidden" name="id" value={member.id} />
                    <input name="name" defaultValue={member.name} style={{ width: 100 }} />
                    <input name="membershipNumber" defaultValue={member.membershipNumber} style={{ width: 80 }} />
                    <button type="submit">Save</button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
