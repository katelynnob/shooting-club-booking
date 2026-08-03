"use client";

import React from "react";
import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { Icon } from "../core/Icon";
import { Tooltip } from "../core/Tooltip";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style" | "aria-label"> {
  /** Phosphor icon name. */
  icon: string;
  /** Required — used as the accessible name and the tooltip text. */
  label: string;
  variant?: "ghost" | "outline" | "danger";
  size?: "lg" | "md" | "sm";
  disabled?: boolean;
  /** Set false only when the surrounding row already names the action. */
  showTooltip?: boolean;
  style?: CSSProperties;
}

/**
 * Square icon-only control. Always needs `label` — it is the accessible
 * name and the tooltip text, so an icon-only action is never unexplained.
 */
export function IconButton({
  icon,
  label,
  variant = "ghost",
  size = "md",
  disabled = false,
  showTooltip = true,
  style,
  ...rest
}: IconButtonProps) {
  const [hover, setHover] = React.useState(false);
  const dim = size === "lg" ? "var(--tap-lg)" : size === "sm" ? "var(--control-h-dense)" : "var(--tap-min)";
  const tone =
    variant === "danger"
      ? { color: "var(--action-danger-quiet-fg)", borderColor: "var(--action-danger-quiet-border)", hover: "var(--field-error-bg)" }
      : variant === "outline"
        ? { color: "var(--action-secondary-fg)", borderColor: "var(--action-secondary-border)", hover: "var(--action-secondary-bg-hover)" }
        : { color: "var(--action-ghost-fg)", borderColor: "transparent", hover: "var(--action-ghost-bg-hover)" };

  const btn = (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: hover && !disabled ? tone.hover : "transparent",
        color: disabled ? "var(--action-disabled-fg)" : tone.color,
        border: "var(--border-w) solid " + (disabled ? "var(--action-disabled-border)" : tone.borderColor),
        borderRadius: "var(--rx)",
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background var(--dur-fast) var(--ease-out)",
        ...style,
      }}
      {...rest}
    >
      <Icon name={icon} size={size === "sm" ? "18px" : "22px"} />
    </button>
  );

  return showTooltip ? <Tooltip text={label}>{btn}</Tooltip> : btn;
}
