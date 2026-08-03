"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface DataTableColumn<Row = Record<string, unknown>> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: number | string;
  sortable?: boolean;
  /** Render mono/tabular — use for membership numbers, times, counts. */
  mono?: boolean;
  render?: (row: Row) => ReactNode;
}

export interface DataTableProps<Row = Record<string, unknown>> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  /** Field used as the React key. Defaults to "id". */
  rowKey?: string;
  sort?: { key: string; dir: "asc" | "desc" };
  onSortChange?: (sort: { key: string; dir: "asc" | "desc" }) => void;
  /** Per-row buttons — approve/reject/deactivate/override. */
  rowActions?: (row: Row) => ReactNode;
  /** Filter controls shown in the header strip. */
  toolbar?: ReactNode;
  /** Small uppercase caption, e.g. "42 members". */
  caption?: string;
  /** Rendered instead of the table body when rows is empty — pass an EmptyState. */
  empty?: ReactNode;
  style?: CSSProperties;
}

/**
 * Admin data table — members, bookings, ranges, event rosters. Sortable
 * headers, an optional toolbar for filters, and per-row actions. Rows are
 * 52px so staff can still tap them on a tablet at the desk; the table
 * scrolls horizontally rather than hiding columns.
 */
export function DataTable<Row extends Record<string, unknown> = Record<string, unknown>>({
  columns = [],
  rows = [],
  rowKey = "id",
  sort,
  onSortChange,
  rowActions,
  toolbar,
  caption,
  empty,
  style,
}: DataTableProps<Row>) {
  const sortBy = (key: string) => {
    if (!onSortChange) return;
    const dir = sort && sort.key === key && sort.dir === "asc" ? "desc" : "asc";
    onSortChange({ key, dir });
  };

  return (
    <div style={{ background: "var(--surface-card)", border: "var(--border-w) solid var(--border-default)", borderRadius: "var(--rx)", ...style }}>
      {(caption || toolbar) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--sp-5)",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "var(--sp-5) var(--sp-6)",
            borderBottom: "var(--border-w) solid var(--border-hairline)",
          }}
        >
          {caption && <span className="hh-label">{caption}</span>}
          {toolbar && <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "center" }}>{toolbar}</div>}
        </div>
      )}

      {rows.length === 0 && empty ? (
        <div style={{ padding: "var(--sp-6)" }}>{empty}</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                {columns.map((c) => {
                  const active = sort && sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      style={{
                        textAlign: c.align || "left",
                        padding: "var(--sp-4) var(--sp-5)",
                        borderBottom: "var(--border-w) solid var(--border-default)",
                        background: "var(--surface-sunken)",
                        whiteSpace: "nowrap",
                        width: c.width,
                      }}
                    >
                      {c.sortable ? (
                        <button
                          type="button"
                          onClick={() => sortBy(c.key)}
                          aria-label={"Sort by " + c.label}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "var(--sp-3)",
                            minHeight: 32,
                            background: "transparent",
                            border: 0,
                            padding: 0,
                            cursor: "pointer",
                            font: "var(--type-small)",
                            fontWeight: "var(--fw-semibold)",
                            letterSpacing: "var(--ls-label)",
                            textTransform: "uppercase",
                            color: active ? "var(--text-strong)" : "var(--text-muted)",
                          }}
                        >
                          {c.label}
                          <Icon name={active ? (sort!.dir === "asc" ? "caret-up" : "caret-down") : "caret-up-down"} size="13px" />
                        </button>
                      ) : (
                        <span className="hh-label">{c.label}</span>
                      )}
                    </th>
                  );
                })}
                {rowActions && (
                  <th
                    scope="col"
                    style={{
                      padding: "var(--sp-4) var(--sp-5)",
                      background: "var(--surface-sunken)",
                      borderBottom: "var(--border-w) solid var(--border-default)",
                      textAlign: "right",
                    }}
                  >
                    <span className="hh-label">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={String(r[rowKey])}>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{
                        padding: "var(--sp-4) var(--sp-5)",
                        borderBottom: "var(--border-w) solid var(--border-hairline)",
                        textAlign: c.align || "left",
                        font: c.mono ? "var(--type-mono-sm)" : "var(--type-small)",
                        color: "var(--text-body)",
                        verticalAlign: "middle",
                      }}
                    >
                      {c.render ? c.render(r) : String(r[c.key] ?? "")}
                    </td>
                  ))}
                  {rowActions && (
                    <td style={{ padding: "var(--sp-3) var(--sp-5)", borderBottom: "var(--border-w) solid var(--border-hairline)" }}>
                      <div style={{ display: "flex", gap: "var(--sp-3)", justifyContent: "flex-end", flexWrap: "wrap" }}>{rowActions(r)}</div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
