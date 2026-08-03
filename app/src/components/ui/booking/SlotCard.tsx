import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";
import { Button } from "../buttons/Button";
import { CoverageBadge, type CoverageState } from "../status/CoverageBadge";
import { CapacityChip } from "../status/CapacityChip";
import { StatusBadge } from "../status/StatusBadge";

export type SlotState = "available" | "booked" | "uncovered" | "full" | "blackout";

export interface SlotCardProps {
  rangeName: string;
  /** Phosphor icon name for the discipline — see DISCIPLINE_ICONS in RangePicker. */
  discipline?: string;
  /** Local club time, e.g. "12:00". */
  start: string;
  end: string;
  /** Places taken: member bookings + logged guests + guest bookings. */
  taken?: number;
  capacity?: number;
  coverage?: CoverageState;
  state?: SlotState;
  /** Guest names logged against this member's booking. */
  guests?: string[];
  /** Extra explanation. Required wording for a blackout (the reason admin gave). */
  note?: string;
  /** Overrides "Book this slot". */
  actionLabel?: string;
  onBook?: () => void;
  onCancel?: () => void;
  /** Set when the 4-hour cancellation cutoff has passed — shown as a tooltip. */
  cancelDisabledReason?: string;
  style?: CSSProperties;
}

/**
 * One bookable time slot on one range.
 * States: available | booked (this member already holds it) | uncovered (no
 * RSO) | full | blackout. Each state carries its own icon + wording, and the
 * uncovered/blackout states add the diagonal stripe so they read in
 * greyscale.
 */
export function SlotCard({
  rangeName,
  discipline,
  start,
  end,
  taken = 0,
  capacity = 0,
  coverage = "full",
  state = "available",
  guests = [],
  note,
  actionLabel,
  onBook,
  onCancel,
  cancelDisabledReason,
  style,
}: SlotCardProps) {
  const blocked = state === "uncovered" || state === "full" || state === "blackout";
  const striped = state === "uncovered" || state === "blackout";
  const booked = state === "booked";

  const reason =
    state === "uncovered"
      ? "No Range Safety Officer is scheduled for this slot, so it cannot be booked."
      : state === "full"
        ? "This slot is fully booked. Cancellations free places immediately, so it is worth checking again."
        : state === "blackout"
          ? note || "This range is closed for maintenance during this period."
          : note;

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-5)",
        padding: "var(--sp-6)",
        background: booked ? "var(--surface-selected)" : "var(--surface-card)",
        backgroundImage: striped ? "var(--coverage-none-stripe)" : undefined,
        border: "var(--border-w) solid " + (booked ? "var(--action-secondary-border)" : "var(--border-default)"),
        borderRadius: "var(--rx)",
        ...style,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--sp-5)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <h3 style={{ font: "var(--type-h3)", display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
            {discipline && <Icon name={discipline} size="20px" color="var(--text-muted)" />}
            {rangeName}
          </h3>
          <p className="hh-num" style={{ fontSize: "var(--fs-base)", color: "var(--text-body)" }}>
            {start} – {end}
          </p>
        </div>
        <CoverageBadge coverage={coverage} size="sm" />
      </header>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "center" }}>
        <CapacityChip taken={taken} capacity={capacity} size="sm" />
        {booked && <StatusBadge status="CONFIRMED" size="sm" label="You're booked" />}
        {guests.length > 0 && (
          <span
            style={{
              font: "var(--type-small)",
              color: "var(--text-muted)",
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-3)",
            }}
          >
            <Icon name="user-plus" size="14px" />
            {guests.join(", ")}
          </span>
        )}
      </div>

      {reason && (
        <p
          style={{
            font: "var(--type-small)",
            color: state === "available" ? "var(--text-muted)" : "var(--coverage-none-fg)",
            lineHeight: "var(--lh-body)",
          }}
        >
          {reason}
        </p>
      )}

      {booked ? (
        <Button
          variant="destructive-quiet"
          iconLeft="x"
          fullWidth
          onClick={onCancel}
          disabled={!!cancelDisabledReason}
          disabledReason={cancelDisabledReason}
        >
          Cancel this booking
        </Button>
      ) : blocked ? (
        <Button
          variant="secondary"
          iconLeft={state === "full" ? "users-three" : "lock-simple"}
          fullWidth
          disabled
          disabledReason={reason}
        >
          {state === "full" ? "Fully booked" : "Unavailable"}
        </Button>
      ) : (
        <Button variant="primary" iconLeft="check" fullWidth onClick={onBook}>
          {actionLabel || "Book this slot"}
        </Button>
      )}
    </article>
  );
}
