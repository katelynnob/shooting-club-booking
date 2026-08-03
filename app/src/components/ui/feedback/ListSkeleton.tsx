import type { CSSProperties } from "react";

export interface ListSkeletonProps {
  rows?: number;
  /** Match the real row height: 96 for slot cards, 72 for booking rows, 52 for table rows. */
  height?: number;
  style?: CSSProperties;
}

/**
 * Loading placeholder for a list of slots, bookings or table rows. Matches
 * the real row height so the page doesn't jump when data lands.
 */
export function ListSkeleton({ rows = 3, height = 96, style }: ListSkeletonProps) {
  return (
    <div aria-busy="true" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", ...style }}>
      <span className="hh-visually-hidden">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height,
            background: "var(--surface-card)",
            border: "var(--border-w) solid var(--border-hairline)",
            borderRadius: "var(--rx)",
            padding: "var(--sp-6)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--sp-5)",
            animation: "hh-pulse 1.4s var(--ease-in-out) infinite",
            animationDelay: i * 120 + "ms",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-5)" }}>
            <span style={{ width: "45%", height: 14, background: "var(--surface-sunken)", borderRadius: "var(--rx-sm)" }} />
            <span style={{ width: 96, height: 14, background: "var(--surface-sunken)", borderRadius: "var(--rx-sm)" }} />
          </div>
          <span style={{ width: "30%", height: 12, background: "var(--surface-sunken)", borderRadius: "var(--rx-sm)" }} />
          <span style={{ width: "100%", height: 20, background: "var(--surface-sunken)", borderRadius: "var(--rx-sm)", marginTop: "auto" }} />
        </div>
      ))}
    </div>
  );
}
