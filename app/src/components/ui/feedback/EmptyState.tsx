import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface EmptyStateProps {
  /** Phosphor icon name. Defaults to "calendar-blank". */
  icon?: string;
  title: string;
  body?: string;
  /** A Button, e.g. "Choose another day". */
  action?: ReactNode;
  style?: CSSProperties;
}

/**
 * Empty list. Always says why the list is empty and what to do instead —
 * "no slots" on a Thursday means the club is shut, not that booking is
 * broken.
 */
export function EmptyState({ icon = "calendar-blank", title, body, action, style }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "var(--sp-5)",
        padding: "var(--sp-10) var(--sp-6)",
        background: "var(--surface-card)",
        border: "var(--border-w) dashed var(--border-default)",
        borderRadius: "var(--rx)",
        ...style,
      }}
    >
      <Icon name={icon} weight="regular" size="34px" color="var(--text-muted)" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", maxWidth: 380 }}>
        <strong style={{ font: "var(--type-h3)" }}>{title}</strong>
        {body && <p style={{ font: "var(--type-small)", color: "var(--text-muted)" }}>{body}</p>}
      </div>
      {action}
    </div>
  );
}
