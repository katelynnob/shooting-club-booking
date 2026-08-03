"use client";

import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export interface PickerDay {
  /** ISO date, e.g. "2026-09-12". Also the value passed to onChange. */
  date: string;
  /** Short weekday, e.g. "Sat". */
  weekday: string;
  /** Day of month, e.g. "12". */
  day: string;
  /** Range/club not open this day — shown dashed and unselectable. */
  closed?: boolean;
  /** A blackout window covers this day — shown with the danger octagon. */
  blackout?: boolean;
  /** Short note under the number, e.g. "2 left". */
  note?: string;
  disabled?: boolean;
}

export interface DayPickerProps {
  days: PickerDay[];
  /** Selected ISO date. */
  value?: string;
  onChange?: (date: string) => void;
  label?: string;
  style?: CSSProperties;
}

/**
 * Horizontal day strip for browsing slots. Only the club's open days are
 * selectable (Wed/Fri/Sat/Sun by default, per range operating hours);
 * closed days stay visible but flat and dashed, so a member can see *why*
 * there is nothing to book rather than wondering where the day went.
 */
export function DayPicker({ days = [], value, onChange, label = "Choose a day", style }: DayPickerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", ...style }}>
      <span className="hh-label">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        style={{ display: "flex", gap: "var(--sp-4)", overflowX: "auto", paddingBottom: "var(--sp-2)", scrollbarWidth: "thin" }}
      >
        {days.map((d) => {
          const selected = d.date === value;
          const off = d.closed || d.disabled;
          return (
            <button
              key={d.date}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={off}
              onClick={() => onChange && onChange(d.date)}
              style={{
                flex: "none",
                minWidth: 62,
                minHeight: "var(--tap-lg)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                padding: "var(--sp-4) var(--sp-3)",
                background: selected ? "var(--action-primary-bg)" : off ? "var(--surface-sunken)" : "var(--surface-card)",
                color: selected ? "var(--action-primary-fg)" : off ? "var(--text-muted)" : "var(--text-body)",
                border:
                  "var(--border-w) " +
                  (off ? "dashed" : "solid") +
                  " " +
                  (selected ? "var(--action-primary-bg)" : "var(--border-default)"),
                borderRadius: "var(--rx)",
                cursor: off ? "not-allowed" : "pointer",
                transition: "background var(--dur-fast) var(--ease-out)",
              }}
            >
              <span
                style={{
                  font: "var(--type-small)",
                  textTransform: "uppercase",
                  letterSpacing: "var(--ls-label)",
                  fontWeight: "var(--fw-semibold)",
                }}
              >
                {d.weekday}
              </span>
              <span className="hh-num" style={{ fontSize: "var(--fs-lg)", fontWeight: "var(--fw-semibold)" }}>
                {d.day}
              </span>
              {d.blackout ? (
                <Icon
                  name="warning-octagon"
                  size="13px"
                  color={selected ? "var(--action-primary-fg)" : "var(--coverage-none-fg)"}
                />
              ) : (
                <span style={{ font: "var(--type-small)", fontSize: 11 }}>{d.closed ? "Closed" : d.note || ""}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
