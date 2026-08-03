import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";

export type CoverageState = "full" | "partial" | "none" | "closed";

/**
 * RSO coverage indicator. Safety-relevant, so it never relies on hue:
 * full = check, partial = warning triangle, none = octagon + diagonal
 * stripe, closed = dash on a flat grey.
 */
export const COVERAGE_META: Record<CoverageState, { label: string; icon: string; tone: string }> = {
  full: { label: "RSO covered", icon: "shield-check", tone: "full" },
  partial: { label: "Part covered", icon: "warning", tone: "partial" },
  none: { label: "No RSO", icon: "warning-octagon", tone: "none" },
  closed: { label: "Range closed", icon: "minus", tone: "closed" },
};

export interface CoverageBadgeProps {
  coverage: CoverageState;
  size?: "md" | "sm";
  /** Overrides the default wording, e.g. "Covered by J. Byrne". */
  label?: string;
  /** Extra detail as a native title, e.g. the covering RSO's shift times. */
  detail?: string;
  style?: CSSProperties;
}

export function CoverageBadge({ coverage, size = "md", label, detail, style }: CoverageBadgeProps) {
  const meta = COVERAGE_META[coverage] || COVERAGE_META.closed;
  const dense = size === "sm";
  return (
    <span
      title={detail}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        padding: dense ? "2px var(--sp-4)" : "var(--sp-2) var(--sp-4)",
        borderRadius: "var(--rx)",
        background: "var(--coverage-" + meta.tone + "-bg)",
        backgroundImage: coverage === "none" ? "var(--coverage-none-stripe)" : undefined,
        border: "var(--border-w) solid currentColor",
        color: "var(--coverage-" + meta.tone + "-fg)",
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
