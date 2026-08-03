import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";
import { Button } from "../buttons/Button";
import { CapacityChip } from "../status/CapacityChip";
import { StatusBadge } from "../status/StatusBadge";

export type EventState = "open" | "registered" | "full" | "cancelled";

export interface EventCardProps {
  title: string;
  kind?: "course" | "competition";
  /** Dark date block, e.g. { day: "26", month: "Sep" }. */
  dateBlock?: { day?: string; month?: string };
  /** Full when/duration line, e.g. "Sat 26 Sep, 10:00 – 16:00". */
  whenLabel?: string;
  /** Range names the event claims, or ["Whole club"]. */
  ranges?: string[];
  taken?: number;
  capacity?: number;
  description?: string;
  /** e.g. "Withdraw by Thu 24 Sep, 10:00". */
  withdrawalLabel?: string;
  state?: EventState;
  onRegister?: () => void;
  onWithdraw?: () => void;
  /** Set once the 48-hour withdrawal cutoff has passed. */
  withdrawDisabledReason?: string;
  style?: CSSProperties;
}

/**
 * A course or competition. Deliberately a different silhouette from
 * SlotCard — dark date block, kicker row, multi-range list — because
 * registering for an event and booking an hour on a range are different
 * commitments with different rules (48-hour withdrawal cutoff, separate
 * capacity, no effect on the 5-booking cap).
 */
export function EventCard({
  title,
  kind = "course",
  dateBlock = {},
  whenLabel,
  ranges = [],
  taken = 0,
  capacity = 0,
  description,
  withdrawalLabel,
  state = "open",
  onRegister,
  onWithdraw,
  withdrawDisabledReason,
  style,
}: EventCardProps) {
  const registered = state === "registered";
  const cancelled = state === "cancelled";
  const full = state === "full";

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-card)",
        border: "var(--border-w) solid " + (registered ? "var(--action-secondary-border)" : "var(--border-default)"),
        borderRadius: "var(--rx)",
        opacity: cancelled ? 0.75 : 1,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-3)",
          padding: "var(--sp-4) var(--sp-6)",
          background: "var(--surface-sunken)",
          borderBottom: "var(--border-w) solid var(--border-hairline)",
          borderTopLeftRadius: "var(--rx)",
          borderTopRightRadius: "var(--rx)",
        }}
      >
        <Icon name={kind === "competition" ? "trophy" : "graduation-cap"} size="16px" color="var(--text-muted)" />
        <span className="hh-label">{kind === "competition" ? "Competition" : "Course"}</span>
        {cancelled && <StatusBadge status="CANCELLED" size="sm" style={{ marginLeft: "auto" }} />}
        {registered && <StatusBadge status="CONFIRMED" size="sm" label="You're registered" style={{ marginLeft: "auto" }} />}
      </div>

      <div style={{ display: "flex", gap: "var(--sp-6)", padding: "var(--sp-6)" }}>
        <div
          style={{
            flex: "none",
            width: 64,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--sp-4) 0",
            background: "var(--surface-inverse)",
            color: "var(--text-inverse)",
            borderRadius: "var(--rx)",
          }}
        >
          <span className="hh-num" style={{ fontSize: "var(--fs-xl)", fontWeight: "var(--fw-bold)", lineHeight: 1 }}>
            {dateBlock.day}
          </span>
          <span style={{ font: "var(--type-small)", textTransform: "uppercase", letterSpacing: "var(--ls-label)" }}>
            {dateBlock.month}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h3 style={{ font: "var(--type-h3)" }}>{title}</h3>
            {whenLabel && (
              <p className="hh-num" style={{ fontSize: "var(--fs-sm)", color: "var(--text-body)" }}>
                {whenLabel}
              </p>
            )}
          </div>

          {ranges.length > 0 && (
            <p
              style={{
                font: "var(--type-small)",
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "flex-start",
                gap: "var(--sp-3)",
              }}
            >
              <Icon name="target" size="15px" style={{ marginTop: 3 }} />
              <span>{ranges.join(" · ")}</span>
            </p>
          )}

          {description && <p style={{ font: "var(--type-small)", color: "var(--text-body)" }}>{description}</p>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", alignItems: "center" }}>
            <CapacityChip taken={taken} capacity={capacity} size="sm" />
            {withdrawalLabel && (
              <span
                style={{
                  font: "var(--type-small)",
                  color: "var(--text-muted)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--sp-3)",
                }}
              >
                <Icon name="clock-countdown" size="14px" />
                {withdrawalLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "0 var(--sp-6) var(--sp-6)" }}>
        {cancelled ? (
          <Button
            variant="secondary"
            fullWidth
            disabled
            disabledReason="This event has been cancelled by the club. Registrants have been emailed."
          >
            Cancelled
          </Button>
        ) : registered ? (
          <Button
            variant="destructive-quiet"
            iconLeft="x"
            fullWidth
            onClick={onWithdraw}
            disabled={!!withdrawDisabledReason}
            disabledReason={withdrawDisabledReason}
          >
            Withdraw from this event
          </Button>
        ) : full ? (
          <Button
            variant="secondary"
            iconLeft="users-three"
            fullWidth
            disabled
            disabledReason="This event is full. Places free up if someone withdraws, so it is worth checking again."
          >
            Fully booked
          </Button>
        ) : (
          <Button variant="primary" iconLeft="check" fullWidth onClick={onRegister}>
            Register
          </Button>
        )}
      </div>
    </article>
  );
}
