import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface BlackoutBannerProps {
  /** What is closed, e.g. "Pistol 25m" or "The whole club". Defaults to "This range". */
  scope?: string;
  /** The window in club time, e.g. "Sat 12 Sep, 13:00 – 16:00". */
  windowLabel?: string;
  /** Admin's reason — always show it. */
  reason?: string;
  /** When the block is a course/competition rather than maintenance, name it here. */
  eventName?: string;
  style?: CSSProperties;
}

/**
 * Blackout notice, shown above the slots it affects. Carries the same
 * diagonal stripe as a blocked slot so the two read as the same fact, and
 * always names the window and the admin's reason — "unavailable" with no
 * reason generates a phone call to the club.
 */
export function BlackoutBanner({ scope = "This range", windowLabel, reason, eventName, style }: BlackoutBannerProps) {
  const isEvent = !!eventName;
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: "var(--sp-4)",
        padding: "var(--sp-5)",
        background: isEvent ? "var(--status-info-bg)" : "var(--coverage-none-bg)",
        backgroundImage: isEvent ? undefined : "var(--coverage-none-stripe)",
        border: "var(--border-w) solid " + (isEvent ? "var(--status-info-border)" : "var(--coverage-none-fg)"),
        borderRadius: "var(--rx)",
        color: isEvent ? "var(--status-info-fg)" : "var(--coverage-none-fg)",
        ...style,
      }}
    >
      <Icon name={isEvent ? "trophy" : "wrench"} size="20px" style={{ marginTop: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", minWidth: 0 }}>
        <strong style={{ font: "var(--type-body-strong)" }}>
          {isEvent ? scope + " is reserved for " + eventName : scope + " is closed"}
        </strong>
        {windowLabel && (
          <span className="hh-num" style={{ fontSize: "var(--fs-sm)" }}>
            {windowLabel}
          </span>
        )}
        {reason && <span style={{ font: "var(--type-small)", lineHeight: "var(--lh-body)" }}>{reason}</span>}
      </div>
    </div>
  );
}
