import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";
import { IconButton } from "../buttons/IconButton";

const TONES: Record<string, { bg: string; border: string; fg: string; icon: string }> = {
  info: { bg: "var(--status-info-bg)", border: "var(--status-info-border)", fg: "var(--status-info-fg)", icon: "info" },
  success: { bg: "var(--status-confirmed-bg)", border: "var(--status-confirmed-border)", fg: "var(--status-confirmed-fg)", icon: "check-circle" },
  warning: { bg: "var(--status-pending-bg)", border: "var(--status-pending-border)", fg: "var(--status-pending-fg)", icon: "warning" },
  danger: { bg: "var(--status-rejected-bg)", border: "var(--status-rejected-border)", fg: "var(--status-rejected-fg)", icon: "warning-octagon" },
};

export interface InlineAlertProps {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  /** Overrides the tone's default Phosphor icon. */
  icon?: string;
  children?: ReactNode;
  /** Buttons, e.g. "View my bookings" after a confirmation. */
  actions?: ReactNode;
  onDismiss?: () => void;
  style?: CSSProperties;
}

/**
 * Inline message tied to the thing it's about: club rules at the point of
 * booking, API errors above the form that produced them, confirmations in
 * place. Never used for anything a member must dismiss to proceed.
 */
export function InlineAlert({ tone = "info", title, icon, children, actions, onDismiss, style }: InlineAlertProps) {
  const t = TONES[tone] || TONES.info;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      style={{
        display: "flex",
        gap: "var(--sp-4)",
        padding: "var(--sp-5)",
        background: t.bg,
        border: "var(--border-w) solid " + t.border,
        borderRadius: "var(--rx)",
        color: t.fg,
        ...style,
      }}
    >
      <Icon name={icon || t.icon} size="20px" style={{ marginTop: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", flex: 1, minWidth: 0 }}>
        {title && <strong style={{ font: "var(--type-body-strong)" }}>{title}</strong>}
        {children && <div style={{ font: "var(--type-small)", color: "inherit", lineHeight: "var(--lh-body)" }}>{children}</div>}
        {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-4)", marginTop: "var(--sp-2)" }}>{actions}</div>}
      </div>
      {onDismiss && (
        <IconButton
          icon="x"
          label="Dismiss"
          size="sm"
          onClick={onDismiss}
          showTooltip={false}
          style={{ color: "inherit", marginTop: -4, marginRight: -4 }}
        />
      )}
    </div>
  );
}
