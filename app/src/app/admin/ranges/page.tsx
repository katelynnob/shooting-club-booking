import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { CreateRangeForm } from "./CreateRangeForm";
import { archiveAction, unarchiveAction, updateCapacityAction } from "./actions";

// specs/01-accounts-and-ranges.md, Behaviour: Range management. Deliberately
// minimal — "Admin UI polish beyond functional CRUD" is out of this spec's
// scope; this exists to prove the CRUD works, not to look good.
export default async function AdminRangesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!session.user.isAdmin && !session.user.isSuperAdmin) redirect("/dashboard");

  const ranges = await db.range.findMany({ orderBy: { name: "asc" } });

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h1>Ranges</h1>

      <h2 style={{ fontSize: "1rem" }}>Create a range</h2>
      <CreateRangeForm />

      <table style={{ width: "100%", marginTop: "2rem", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
            <th>Name</th>
            <th>Discipline</th>
            <th>Capacity</th>
            <th>Archived</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ranges.map((range) => (
            <tr key={range.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{range.name}</td>
              <td>{range.discipline}</td>
              <td>{range.capacity}</td>
              <td>{range.archived ? "Yes" : "No"}</td>
              <td>
                <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                  <form action={updateCapacityAction} style={{ display: "flex", gap: "0.25rem" }}>
                    <input type="hidden" name="id" value={range.id} />
                    <input name="capacity" type="number" min={1} defaultValue={range.capacity} style={{ width: 60 }} />
                    <button type="submit">Save capacity</button>
                  </form>
                  {range.archived ? (
                    <form action={unarchiveAction}>
                      <input type="hidden" name="id" value={range.id} />
                      <button type="submit">Unarchive</button>
                    </form>
                  ) : (
                    <form action={archiveAction}>
                      <input type="hidden" name="id" value={range.id} />
                      <button type="submit">Archive</button>
                    </form>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
