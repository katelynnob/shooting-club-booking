"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data/DataTable";
import { StatusBadge } from "@/components/ui/status/StatusBadge";
import { Button } from "@/components/ui/buttons/Button";
import { fieldStyle } from "@/components/ui/forms/FormField";
import { archiveAction, unarchiveAction, updateCapacityAction } from "./actions";

export interface RangeRow {
  // See MembersTable.tsx's MemberRow for why this index signature is here —
  // DataTable's generic constraint needs it even though every field below
  // already satisfies it structurally.
  [key: string]: unknown;
  id: string;
  name: string;
  discipline: string;
  capacity: number;
  archived: boolean;
}

export function RangesTable({ ranges }: { ranges: RangeRow[] }) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

  const rows = [...ranges].sort((a, b) => {
    const av = String(a[sort.key] ?? "");
    const bv = String(b[sort.key] ?? "");
    return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.dir === "asc" ? 1 : -1);
  });

  const columns: DataTableColumn<RangeRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (r) => <strong style={{ font: "var(--type-body-strong)", fontSize: "var(--fs-sm)" }}>{r.name}</strong>,
    },
    { key: "discipline", label: "Discipline", sortable: true },
    { key: "capacity", label: "Capacity", mono: true, sortable: true },
    {
      key: "archived",
      label: "Status",
      sortable: true,
      render: (r) => (
        <StatusBadge status={r.archived ? "DEACTIVATED" : "APPROVED"} label={r.archived ? "Archived" : "Active"} size="sm" />
      ),
    },
  ];

  return (
    <DataTable<RangeRow>
      caption={`${ranges.length} range${ranges.length === 1 ? "" : "s"}`}
      sort={sort}
      onSortChange={setSort}
      columns={columns}
      rows={rows}
      rowActions={(r) => (
        <div style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <form action={updateCapacityAction} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
            <input type="hidden" name="id" value={r.id} />
            <input
              name="capacity"
              type="number"
              min={1}
              defaultValue={r.capacity}
              aria-label="Capacity"
              style={{ ...fieldStyle(), minHeight: "var(--control-h-dense)", width: 64, fontSize: "var(--fs-sm)" }}
            />
            <Button type="submit" size="sm" variant="secondary" iconLeft="floppy-disk">
              Save
            </Button>
          </form>
          {r.archived ? (
            <form action={unarchiveAction}>
              <input type="hidden" name="id" value={r.id} />
              <Button type="submit" size="sm" variant="secondary" iconLeft="arrow-counter-clockwise">
                Unarchive
              </Button>
            </form>
          ) : (
            <form action={archiveAction}>
              <input type="hidden" name="id" value={r.id} />
              <Button type="submit" size="sm" variant="destructive-quiet" iconLeft="archive">
                Archive
              </Button>
            </form>
          )}
        </div>
      )}
    />
  );
}
