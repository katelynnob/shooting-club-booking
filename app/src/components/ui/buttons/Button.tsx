"use client";

import React from "react";
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";
import { Tooltip } from "../core/Tooltip";

// Exported so ButtonLink (same folder) can render <Link> with identical
// styling — Button itself stays a plain <button>, never an anchor.
export const BUTTON_VARIANTS: Record<string, CSSProperties> = {
  primary: {
    background: "var(--action-primary-bg)",
    color: "var(--action-primary-fg)",
    borderColor: "var(--action-primary-bg)",
  },
  secondary: {
    background: "var(--action-secondary-bg)",
    color: "var(--action-secondary-fg)",
    borderColor: "var(--action-secondary-border)",
  },
  destructive: {
    background: "var(--action-danger-bg)",
    color: "var(--action-danger-fg)",
    borderColor: "var(--action-danger-bg)",
  },
  "destructive-quiet": {
    background: "transparent",
    color: "var(--action-danger-quiet-fg)",
    borderColor: "var(--action-danger-quiet-border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--action-ghost-fg)",
    borderColor: "transparent",
  },
};

export const BUTTON_HOVER: Record<string, string> = {
  primary: "var(--action-primary-bg-hover)",
  secondary: "var(--action-secondary-bg-hover)",
  destructive: "var(--action-danger-bg-hover)",
  "destructive-quiet": "var(--field-error-bg)",
  ghost: "var(--action-ghost-bg-hover)",
};

export const BUTTON_SIZES: Record<string, CSSProperties> = {
  lg: { minHeight: "var(--tap-lg)", padding: "0 var(--sp-7)", fontSize: "var(--fs-lg)" },
  md: { minHeight: "var(--tap-min)", padding: "0 var(--sp-6)", fontSize: "var(--fs-base)" },
  /* Pointer-device density only (admin tables). Never on a member screen. */
  sm: { minHeight: "var(--control-h-dense)", padding: "0 var(--sp-5)", fontSize: "var(--fs-sm)" },
};

/**
 * The system's action control. Primary is the single booking-committing
 * action on a screen; destructive is reserved for cancel/withdraw/reject.
 */
export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  variant?: "primary" | "secondary" | "destructive" | "destructive-quiet" | "ghost";
  /** lg = 56px, md = 48px (member default), sm = 40px (admin tables, pointer only). */
  size?: "lg" | "md" | "sm";
  /** Phosphor icon name shown before the label. */
  iconLeft?: string;
  /** Phosphor icon name shown after the label. */
  iconRight?: string;
  fullWidth?: boolean;
  /** Swaps the leading icon for a spinner and blocks interaction. */
  loading?: boolean;
  disabled?: boolean;
  /** Why it's unavailable. Renders a tooltip on hover, focus and tap. */
  disabledReason?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export function Button({
  variant = "primary",
  size = "md",
  iconLeft,
  iconRight,
  fullWidth = false,
  loading = false,
  disabled = false,
  disabledReason,
  type = "button",
  children,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = React.useState(false);
  const off = disabled || loading;
  const base = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;

  const button = (
    <button
      type={type}
      disabled={off}
      aria-busy={loading || undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--sp-4)",
        width: fullWidth ? "100%" : undefined,
        border: "var(--border-w) solid",
        borderRadius: "var(--rx)",
        fontFamily: "var(--font-sans)",
        fontWeight: "var(--fw-semibold)",
        lineHeight: 1,
        textDecoration: "none",
        cursor: off ? "not-allowed" : "pointer",
        transition: "background var(--dur-fast) var(--ease-out), transform var(--dur-instant) var(--ease-out)",
        ...BUTTON_SIZES[size],
        ...base,
        ...(hover && !off ? { background: BUTTON_HOVER[variant] } : null),
        ...(off
          ? {
              background: variant === "ghost" ? "transparent" : "var(--action-disabled-bg)",
              color: "var(--action-disabled-fg)",
              borderColor: variant === "ghost" ? "transparent" : "var(--action-disabled-border)",
            }
          : null),
        ...style,
      }}
      {...rest}
    >
      {loading && <Icon name="circle-notch" style={{ animation: "hh-spin 900ms linear infinite" }} />}
      {!loading && iconLeft && <Icon name={iconLeft} size="1.15em" />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size="1.15em" />}
    </button>
  );

  if (off && disabledReason) {
    return (
      <Tooltip text={disabledReason} style={fullWidth ? { width: "100%" } : undefined}>
        <span style={{ display: "inline-flex", width: fullWidth ? "100%" : undefined }}>{button}</span>
      </Tooltip>
    );
  }
  return button;
}
