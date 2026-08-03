import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export type StatusKey =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "DEACTIVATED"
  | "CONFIRMED"
  | "CANCELLED"
  | "WITHDRAWN"
  | "ATTENDED"
  | "NO_SHOW"
  | "CONFLICT"
  | "INVITED";

/**
 * Every status in the system, in one place. Status drives which actions are
 * available, so it is always rendered as colour + icon + word — never a
 * bare coloured dot. Keys match the Prisma enums (MemberStatus, booking
 * states).
 */
export const STATUS_META: Record<StatusKey, { label: string; icon: string; tone: string }> = {
  PENDING: { label: "Pending", icon: "hourglass-high", tone: "pending" },
  APPROVED: { label: "Approved", icon: "check-circle", tone: "approved" },
  REJECTED: { label: "Rejected", icon: "x-circle", tone: "rejected" },
  DEACTIVATED: { label: "Deactivated", icon: "prohibit", tone: "deactivated" },
  CONFIRMED: { label: "Confirmed", icon: "check-circle", tone: "confirmed" },
  CANCELLED: { label: "Cancelled", icon: "arrow-u-up-left", tone: "cancelled" },
  WITHDRAWN: { label: "Withdrawn", icon: "arrow-u-up-left", tone: "cancelled" },
  ATTENDED: { label: "Attended", icon: "seal-check", tone: "approved" },
  NO_SHOW: { label: "No-show", icon: "user-minus", tone: "rejected" },
  /* Bookings left uncovered by a shift change or caught inside a new blackout —
     admin resolves these manually (spec 04, conflicts view). */
  CONFLICT: { label: "Needs review", icon: "warning", tone: "pending" },
  INVITED: { label: "Invited", icon: "envelope-simple", tone: "info" },
};

export interface StatusBadgeProps {
  status: StatusKey;
  /** md = alongside body copy, sm = inside table rows and list items. */
  size?: "md" | "sm";
  /** Overrides the default word. Use only for a genuinely different label. */
  label?: string;
  style?: CSSProperties;
}

export function StatusBadge({ status, size = "md", label, style }: StatusBadgeProps) {
  const meta = STATUS_META[status] || { label: label || String(status), icon: "circle", tone: "cancelled" };
  const t = meta.tone;
  const dense = size === "sm";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        padding: dense ? "2px var(--sp-4)" : "var(--sp-2) var(--sp-4)",
        background: "var(--status-" + t + "-bg)",
        border: "var(--border-w) solid var(--status-" + t + "-border)",
        color: "var(--status-" + t + "-fg)",
        borderRadius: "var(--rx)",
        font: dense ? "var(--type-small)" : "var(--type-body-strong)",
        fontWeight: "var(--fw-semibold)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <Icon name={meta.icon} size={dense ? "14px" : "16px"} />
      {label || meta.label}
    </span>
  );
}
