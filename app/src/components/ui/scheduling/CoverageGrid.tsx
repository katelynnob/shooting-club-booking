"use client";

import React from "react";
import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

const CELL: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
  full: { bg: "var(--coverage-full-bg)", fg: "var(--coverage-full-fg)", icon: "check", label: "Covered" },
  partial: { bg: "var(--coverage-partial-bg)", fg: "var(--coverage-partial-fg)", icon: "warning", label: "Part covered" },
  none: { bg: "var(--coverage-none-bg)", fg: "var(--coverage-none-fg)", icon: "x", label: "No cover" },
  closed: { bg: "var(--coverage-closed-bg)", fg: "var(--coverage-closed-fg)", icon: "minus", label: "Closed" },
};

export interface GridDay {
  /** ISO date — used with the hour label as the cells key. */
  date: string;
  weekday: string;
  day: string;
}

export interface GridHour {
  /** Displayed and used in the cells key, e.g. "11:00". */
  label: string;
}

export interface GridCell {
  state: "full" | "partial" | "none" | "closed";
  /** True when the signed-in RSO is covering this hour (mode="rso"). */
  mine?: boolean;
  /** Bookings already held in this hour — an uncovered hour with bookings is the urgent case. */
  bookings?: number;
  /** Tooltip detail, e.g. "J. Byrne 11:00–16:00". */
  detail?: string;
}

export interface CoverageGridProps {
  days: GridDay[];
  hours: GridHour[];
  /** Keyed `${date}|${hourLabel}`. */
  cells: Record<string, GridCell>;
  /** "rso" makes open cells tappable; "admin" is read-only. */
  mode?: "rso" | "admin";
  rangeName?: string;
  onToggleCell?: (date: string, hourLabel: string) => void;
  style?: CSSProperties;
}

/**
 * Weekly coverage grid. Two modes:
 * - mode="rso": an RSO taps cells to mark their own availability (selected
 *   cells carry a filled shield and the brand fill).
 * - mode="admin": read-only view of coverage across the week, so a gap is
 *   visible at a glance.
 * Uncovered cells add the diagonal stripe — a gap must be findable without
 * relying on hue. Booking counts are shown when a slot has bookings, since
 * an uncovered slot *with* bookings is the case admin must resolve first.
 */
export function CoverageGrid({ days = [], hours = [], cells = {}, mode = "admin", rangeName, onToggleCell, style }: CoverageGridProps) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)", ...style }}>
      <header style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "var(--sp-4)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span className="hh-label">{mode === "rso" ? "My availability" : "RSO coverage"}</span>
          {rangeName && <h3 style={{ font: "var(--type-h3)" }}>{rangeName}</h3>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-5)" }}>
          {(["full", "partial", "none", "closed"] as const).map((k) => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-3)", font: "var(--type-small)", color: "var(--text-muted)" }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: CELL[k].bg,
                  backgroundImage: k === "none" ? "var(--coverage-none-stripe)" : undefined,
                  color: CELL[k].fg,
                  border: "var(--border-w) solid currentColor",
                  borderRadius: "var(--rx-sm)",
                }}
              >
                <Icon name={CELL[k].icon} size="11px" />
              </span>
              {CELL[k].label}
            </span>
          ))}
        </div>
      </header>

      <div style={{ overflowX: "auto" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "64px repeat(" + days.length + ", minmax(72px, 1fr))",
            gap: "var(--sp-2)",
            minWidth: 64 + days.length * 76,
          }}
        >
          <span />
          {days.map((d) => (
            <div key={d.date} style={{ textAlign: "center", padding: "0 0 var(--sp-3)" }}>
              <div className="hh-label" style={{ color: "var(--text-muted)" }}>
                {d.weekday}
              </div>
              <div className="hh-num" style={{ fontSize: "var(--fs-sm)", color: "var(--text-body)", fontWeight: "var(--fw-semibold)" }}>
                {d.day}
              </div>
            </div>
          ))}

          {hours.map((h) => (
            <React.Fragment key={h.label}>
              <div
                className="hh-num"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: "var(--sp-4)",
                  fontSize: "var(--fs-xs)",
                  color: "var(--text-muted)",
                }}
              >
                {h.label}
              </div>
              {days.map((d) => {
                const cell = cells[d.date + "|" + h.label] || { state: "closed" as const };
                const meta = CELL[cell.state] || CELL.closed;
                const mine = cell.mine;
                const interactive = mode === "rso" && cell.state !== "closed";
                const Tag = interactive ? "button" : "div";
                return (
                  <Tag
                    key={d.date + h.label}
                    type={interactive ? "button" : undefined}
                    onClick={interactive ? () => onToggleCell && onToggleCell(d.date, h.label) : undefined}
                    aria-pressed={interactive ? !!mine : undefined}
                    aria-label={
                      interactive
                        ? d.weekday + " " + h.label + " — " + (mine ? "you are covering this hour" : "mark yourself available")
                        : undefined
                    }
                    title={cell.detail || meta.label}
                    style={{
                      minHeight: 44,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 1,
                      background: mine ? "var(--action-primary-bg)" : meta.bg,
                      backgroundImage: !mine && cell.state === "none" ? "var(--coverage-none-stripe)" : undefined,
                      color: mine ? "var(--action-primary-fg)" : meta.fg,
                      border: "var(--border-w) solid " + (mine ? "var(--action-primary-bg)" : "var(--border-hairline)"),
                      borderRadius: "var(--rx-sm)",
                      cursor: interactive ? "pointer" : "default",
                      transition: "background var(--dur-fast) var(--ease-out)",
                      padding: 2,
                    }}
                  >
                    <Icon name={mine ? "shield-check" : meta.icon} size="14px" />
                    {(cell.bookings ?? 0) > 0 && (
                      <span className="hh-num" style={{ fontSize: 10, fontWeight: "var(--fw-semibold)" }}>
                        {cell.bookings} bk
                      </span>
                    )}
                  </Tag>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}
