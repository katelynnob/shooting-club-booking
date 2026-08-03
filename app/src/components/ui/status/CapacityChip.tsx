import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface CapacityChipProps {
  /** Places already taken: member bookings + logged guests + guest bookings. */
  taken: number;
  /** The range's or event's fixed capacity. */
  capacity: number;
  size?: "md" | "sm";
  style?: CSSProperties;
}

/**
 * Remaining capacity, counting members + their logged guests + guest
 * bookings against the range's fixed capacity. Tone steps at "one place
 * left" and "full", because those are the two facts that change what a
 * member does next.
 */
export function CapacityChip({ taken, capacity, size = "md", style }: CapacityChipProps) {
  const left = Math.max(0, capacity - taken);
  const full = left === 0;
  const low = !full && left <= Math.max(1, Math.round(capacity * 0.25));
  const tone = full ? "rejected" : low ? "pending" : "approved";
  const icon = "users-three";
  const dense = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        padding: dense ? "2px var(--sp-4)" : "var(--sp-2) var(--sp-4)",
        borderRadius: "var(--rx)",
        background: "var(--status-" + tone + "-bg)",
        border: "var(--border-w) solid var(--status-" + tone + "-border)",
        color: "var(--status-" + tone + "-fg)",
        font: dense ? "var(--type-small)" : "var(--type-body-strong)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <Icon name={icon} size={dense ? "14px" : "16px"} />
      {full ? (
        <span>Full</span>
      ) : (
        <span>
          <span className="hh-num">{left}</span> of <span className="hh-num">{capacity}</span> place
          {left === 1 ? "" : "s"} left
        </span>
      )}
    </span>
  );
}
