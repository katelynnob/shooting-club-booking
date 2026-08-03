import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";
import { Button } from "../buttons/Button";
import { StatusBadge, type StatusKey } from "../status/StatusBadge";

export interface BookingListItemProps {
  rangeName: string;
  /** Phosphor discipline icon name. */
  discipline?: string;
  /** e.g. "Sat 12 September". */
  dateLabel: string;
  start: string;
  end: string;
  status?: StatusKey;
  /** Guest names logged against the booking. */
  guests?: string[];
  /** Who holds the booking — admin views only. */
  bookedBy?: string;
  /** "member" (default) or "guest" for an independent guest booking. */
  bookedByKind?: "member" | "guest";
  /** Conflict explanation, e.g. "Uncovered — RSO shift was shortened". */
  note?: string;
  onCancel?: () => void;
  cancelLabel?: string;
  /** Set to explain why cancelling isn't possible (cutoff passed). */
  cancelDisabledReason?: string;
  /** Extra buttons, e.g. an admin override. */
  actions?: ReactNode;
  style?: CSSProperties;
}

/**
 * A row in "My bookings" (member) or "All bookings" (admin). Same
 * component both places: pass `bookedBy` and admin actions to get the
 * staff view.
 */
export function BookingListItem({
  rangeName,
  discipline,
  dateLabel,
  start,
  end,
  status = "CONFIRMED",
  guests = [],
  bookedBy,
  bookedByKind,
  note,
  onCancel,
  cancelLabel = "Cancel",
  cancelDisabledReason,
  actions,
  style,
}: BookingListItemProps) {
  const past = status === "CANCELLED" || status === "WITHDRAWN" || status === "NO_SHOW";
  return (
    <div
      style={{
        display: "flex",
        gap: "var(--sp-5)",
        alignItems: "flex-start",
        padding: "var(--sp-6)",
        background: "var(--surface-card)",
        borderBottom: "var(--border-w) solid var(--border-hairline)",
        opacity: past ? 0.72 : 1,
        ...style,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--sp-4)" }}>
          <span style={{ font: "var(--type-body-strong)", display: "inline-flex", alignItems: "center", gap: "var(--sp-3)" }}>
            {discipline && <Icon name={discipline} size="18px" color="var(--text-muted)" />}
            {rangeName}
          </span>
          <StatusBadge status={status} size="sm" />
        </div>
        <div style={{ font: "var(--type-small)", color: "var(--text-body)", display: "flex", flexWrap: "wrap", gap: "var(--sp-4)" }}>
          <span>{dateLabel}</span>
          <span className="hh-num">
            {start} – {end}
          </span>
        </div>
        {bookedBy && (
          <div
            style={{
              font: "var(--type-small)",
              color: "var(--text-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-3)",
            }}
          >
            <Icon name={bookedByKind === "guest" ? "user-circle-dashed" : "user"} size="14px" />
            {bookedBy}
            {bookedByKind === "guest" && <span style={{ color: "var(--text-muted)" }}>· guest booking</span>}
          </div>
        )}
        {guests.length > 0 && (
          <div
            style={{
              font: "var(--type-small)",
              color: "var(--text-muted)",
              display: "inline-flex",
              alignItems: "flex-start",
              gap: "var(--sp-3)",
            }}
          >
            <Icon name="user-plus" size="14px" style={{ marginTop: 3 }} />
            <span>
              {guests.length} guest{guests.length === 1 ? "" : "s"}: {guests.join(", ")}
            </span>
          </div>
        )}
        {note && <p style={{ font: "var(--type-small)", color: "var(--coverage-none-fg)" }}>{note}</p>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", alignItems: "stretch" }}>
        {actions}
        {onCancel && !past && (
          <Button
            variant="destructive-quiet"
            size="sm"
            iconLeft="x"
            onClick={onCancel}
            disabled={!!cancelDisabledReason}
            disabledReason={cancelDisabledReason}
          >
            {cancelLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
