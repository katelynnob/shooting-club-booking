"use client";

import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/data/DataTable";
import { StatusBadge, type StatusKey } from "@/components/ui/status/StatusBadge";
import { Button } from "@/components/ui/buttons/Button";
import { TextField } from "@/components/ui/forms/TextField";
import { SelectField } from "@/components/ui/forms/SelectField";
import { fieldStyle } from "@/components/ui/forms/FormField";
import { EmptyState } from "@/components/ui/feedback/EmptyState";
import {
  approveAction,
  rejectAction,
  deactivateAction,
  reactivateAction,
  setRsoAction,
  setAdminAction,
  resendInviteAction,
  patchMemberAction,
} from "./actions";

export interface MemberRow {
  // Plain interfaces don't structurally satisfy DataTable's Record<string,
  // unknown> generic constraint without an explicit index signature, even
  // though every declared property already is one.
  [key: string]: unknown;
  id: string;
  name: string;
  email: string;
  membershipNumber: string;
  status: StatusKey;
  isRso: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "DEACTIVATED", label: "Deactivated" },
];

function roleLabel(m: MemberRow) {
  return [m.isSuperAdmin && "Super Admin", m.isAdmin && !m.isSuperAdmin && "Admin", m.isRso && "RSO"].filter(Boolean).join(" · ") || "—";
}

function EditMemberForm({ member }: { member: MemberRow }) {
  return (
    <form action={patchMemberAction} style={{ display: "flex", gap: "var(--sp-3)", alignItems: "center" }}>
      <input type="hidden" name="id" value={member.id} />
      <input
        name="name"
        defaultValue={member.name}
        aria-label="Name"
        style={{ ...fieldStyle(), minHeight: "var(--control-h-dense)", width: 110, fontSize: "var(--fs-sm)" }}
      />
      <input
        name="membershipNumber"
        defaultValue={member.membershipNumber}
        aria-label="Membership number"
        style={{ ...fieldStyle(), minHeight: "var(--control-h-dense)", width: 90, fontSize: "var(--fs-sm)" }}
      />
      <Button type="submit" size="sm" variant="secondary" iconLeft="floppy-disk">
        Save
      </Button>
    </form>
  );
}

export function MembersTable({
  members,
  isSuperAdmin,
  currentUserId,
}: {
  members: MemberRow[];
  isSuperAdmin: boolean;
  currentUserId: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "status", dir: "asc" });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const rows = members
    .filter((m) => (statusFilter ? m.status === statusFilter : true))
    .filter((m) => (query ? (m.name + m.email + m.membershipNumber).toLowerCase().includes(query.toLowerCase()) : true))
    .sort((a, b) => {
      const av = String(a[sort.key as keyof MemberRow] ?? "");
      const bv = String(b[sort.key as keyof MemberRow] ?? "");
      return (av > bv ? 1 : av < bv ? -1 : 0) * (sort.dir === "asc" ? 1 : -1);
    });

  const columns: DataTableColumn<MemberRow>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (r) => <strong style={{ font: "var(--type-body-strong)", fontSize: "var(--fs-sm)" }}>{r.name}</strong>,
    },
    { key: "membershipNumber", label: "Membership #", mono: true, sortable: true },
    { key: "email", label: "Email" },
    { key: "roles", label: "Roles", render: roleLabel },
    { key: "status", label: "Status", sortable: true, render: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  return (
    <DataTable<MemberRow>
      caption={`${rows.length} of ${members.length} members`}
      sort={sort}
      onSortChange={setSort}
      toolbar={
        <>
          <TextField
            id="member-search"
            label=""
            placeholder="Search name, email or number"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 220 }}
          />
          <SelectField
            id="status-filter"
            label=""
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            style={{ minWidth: 160 }}
          />
        </>
      }
      columns={columns}
      rows={rows}
      empty={<EmptyState icon="users-three" title="No members match these filters" body="Clear the search or choose a different status." />}
      rowActions={(m) => (
        <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {m.status === "PENDING" && (
            <>
              <form action={approveAction}>
                <input type="hidden" name="id" value={m.id} />
                <Button type="submit" size="sm" variant="secondary" iconLeft="check">
                  Approve
                </Button>
              </form>
              <form action={rejectAction}>
                <input type="hidden" name="id" value={m.id} />
                <Button type="submit" size="sm" variant="destructive-quiet" iconLeft="x">
                  Reject
                </Button>
              </form>
            </>
          )}
          {m.status === "APPROVED" && !m.isSuperAdmin && m.id !== currentUserId && (
            <form action={deactivateAction}>
              <input type="hidden" name="id" value={m.id} />
              <Button type="submit" size="sm" variant="destructive-quiet" iconLeft="prohibit">
                Deactivate
              </Button>
            </form>
          )}
          {m.status === "DEACTIVATED" && (
            <form action={reactivateAction}>
              <input type="hidden" name="id" value={m.id} />
              <Button type="submit" size="sm" variant="secondary" iconLeft="arrow-counter-clockwise">
                Reactivate
              </Button>
            </form>
          )}
          <form action={setRsoAction}>
            <input type="hidden" name="id" value={m.id} />
            <input type="hidden" name="isRso" value={(!m.isRso).toString()} />
            <Button type="submit" size="sm" variant="secondary" iconLeft="shield-check">
              {m.isRso ? "Revoke RSO" : "Grant RSO"}
            </Button>
          </form>
          {isSuperAdmin && (
            <form action={setAdminAction}>
              <input type="hidden" name="id" value={m.id} />
              <input type="hidden" name="isAdmin" value={(!m.isAdmin).toString()} />
              <Button type="submit" size="sm" variant="secondary" iconLeft="user-gear">
                {m.isAdmin ? "Revoke Admin" : "Grant Admin"}
              </Button>
            </form>
          )}
          <form action={resendInviteAction}>
            <input type="hidden" name="id" value={m.id} />
            <Button type="submit" size="sm" variant="secondary" iconLeft="envelope-simple">
              Resend invite
            </Button>
          </form>
          <EditMemberForm member={m} />
        </div>
      )}
    />
  );
}
