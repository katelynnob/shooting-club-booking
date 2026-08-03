import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";
import { IconButton } from "../buttons/IconButton";

const TONES: Record<string, { icon: string; accent: string }> = {
  success: { icon: "check-circle", accent: "var(--ok-300)" },
  error: { icon: "warning-octagon", accent: "var(--danger-300)" },
  info: { icon: "info", accent: "var(--brand-300)" },
};

export interface ToastProps {
  tone?: "success" | "error" | "info";
  /** One line, past tense: "Booking confirmed". */
  message: string;
  /** Optional second line, e.g. "Confirmation email sent to aoife@example.ie". */
  detail?: string;
  onDismiss?: () => void;
  /** "fixed" floats bottom-centre (default); "relative" places it in flow for demos. */
  position?: "fixed" | "relative";
  style?: CSSProperties;
}

/**
 * Transient confirmation for something that already happened ("Booking
 * confirmed — email on its way"). Anything a member needs to act on stays
 * inline instead. Sits above the sticky action bar on mobile.
 */
export function Toast({ tone = "success", message, detail, onDismiss, position = "fixed", style }: ToastProps) {
  const t = TONES[tone] || TONES.info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      style={{
        position: position === "fixed" ? "fixed" : "relative",
        left: position === "fixed" ? "var(--sp-6)" : undefined,
        right: position === "fixed" ? "var(--sp-6)" : undefined,
        bottom: position === "fixed" ? "var(--sp-6)" : undefined,
        zIndex: 40,
        display: "flex",
        gap: "var(--sp-4)",
        alignItems: "flex-start",
        maxWidth: 520,
        margin: position === "fixed" ? "0 auto" : undefined,
        padding: "var(--sp-5)",
        background: "var(--surface-inverse)",
        color: "var(--text-inverse)",
        border: "var(--border-w) solid transparent",
        borderLeft: "3px solid " + t.accent,
        borderRadius: "var(--rx)",
        boxShadow: "var(--shadow-pop)",
        animation: "hh-toast-in var(--dur) var(--ease-out)",
        ...style,
      }}
    >
      <Icon name={t.icon} size="20px" color={t.accent} style={{ marginTop: 1 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
        <strong style={{ font: "var(--type-body-strong)" }}>{message}</strong>
        {detail && <span style={{ font: "var(--type-small)", opacity: 0.85 }}>{detail}</span>}
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
