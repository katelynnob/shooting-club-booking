import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";
import { CoverageBadge, type CoverageState } from "../status/CoverageBadge";

/**
 * The club's six ranges. Icons only — no photography needed — but each
 * tile is a 56px+ target with the discipline name spelled out, because
 * "Rifle 50m Benchrest" and "Rifle 50m Gallery" are easy to confuse in a
 * hurry.
 */
export const DISCIPLINE_ICONS: Record<string, string> = {
  "rifle-100m": "crosshair",
  "rifle-50m-benchrest": "crosshair-simple",
  "rifle-50m-gallery": "scan",
  "pistol-25m": "circles-three",
  "clay-pigeon": "bird",
  archery: "target",
};

export interface PickerRange {
  id: string;
  name: string;
  /** Slug used to look up the default icon: "rifle-100m", "clay-pigeon", "archery"… */
  slug?: string;
  /** Explicit Phosphor icon name, overrides the slug lookup. */
  icon?: string;
  capacity?: number;
  /** Replaces the "N lanes" sub-label. */
  meta?: string;
  /** Shows a coverage badge on the tile — useful on admin and RSO screens. */
  coverage?: CoverageState;
  archived?: boolean;
  disabled?: boolean;
}

export interface RangePickerProps {
  ranges: PickerRange[];
  value?: string;
  onChange?: (id: string) => void;
  /** 1 on narrow phones, 2 by default, 3 on admin screens. */
  columns?: number;
  label?: string;
  style?: CSSProperties;
}

export function RangePicker({ ranges = [], value, onChange, columns = 2, label = "Choose a range", style }: RangePickerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)", ...style }}>
      {label && <span className="hh-label">{label}</span>}
      <div
        role="radiogroup"
        aria-label={label}
        style={{ display: "grid", gridTemplateColumns: "repeat(" + columns + ", minmax(0, 1fr))", gap: "var(--sp-4)" }}
      >
        {ranges.map((r) => {
          const selected = r.id === value;
          const off = r.archived || r.disabled;
          return (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={off}
              onClick={() => onChange && onChange(r.id)}
              style={{
                minHeight: "var(--tap-lg)",
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-4)",
                padding: "var(--sp-5)",
                textAlign: "left",
                background: selected ? "var(--surface-selected)" : off ? "var(--surface-sunken)" : "var(--surface-card)",
                color: off ? "var(--text-muted)" : "var(--text-strong)",
                border: "var(--border-w) solid " + (selected ? "var(--action-primary-bg)" : "var(--border-default)"),
                boxShadow: selected ? "inset 0 0 0 1px var(--action-primary-bg)" : undefined,
                borderRadius: "var(--rx)",
                cursor: off ? "not-allowed" : "pointer",
                transition: "background var(--dur-fast) var(--ease-out)",
              }}
            >
              <Icon
                name={r.icon || DISCIPLINE_ICONS[r.slug ?? ""] || "target"}
                size="26px"
                color={selected ? "var(--action-primary-bg)" : "var(--text-muted)"}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ font: "var(--type-body-strong)" }}>{r.name}</span>
                <span style={{ font: "var(--type-small)", color: "var(--text-muted)" }}>
                  {off ? (
                    "Archived"
                  ) : (
                    r.meta || (
                      <span>
                        <span className="hh-num">{r.capacity}</span> lanes
                      </span>
                    )
                  )}
                </span>
              </span>
              {r.coverage && <CoverageBadge coverage={r.coverage} size="sm" style={{ marginLeft: "auto" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
