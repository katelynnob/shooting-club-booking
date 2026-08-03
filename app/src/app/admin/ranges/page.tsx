import { db } from "@/lib/db";
import { CreateRangeForm } from "./CreateRangeForm";
import { RangesTable } from "./RangesTable";

// specs/01-accounts-and-ranges.md, Behaviour: Range management.
// Auth/role gating lives in app/admin/layout.tsx.
export default async function AdminRangesPage() {
  const ranges = await db.range.findMany({ orderBy: { name: "asc" } });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-7)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
        <h1 style={{ font: "var(--type-h1)" }}>Ranges</h1>
        <p style={{ font: "var(--type-small)", color: "var(--text-muted)" }}>
          Archived ranges drop out of the public booking list but stay visible here.
        </p>
      </div>

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
        <span className="hh-label">Create a range</span>
        <CreateRangeForm />
      </div>

      <RangesTable ranges={ranges} />
    </div>
  );
}
