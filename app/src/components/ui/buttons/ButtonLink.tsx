"use client";

import React from "react";
import type { AnchorHTMLAttributes, CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { Icon } from "../core/Icon";
import { BUTTON_HOVER, BUTTON_SIZES, BUTTON_VARIANTS } from "./Button";

export interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "style" | "href"> {
  href: string;
  variant?: "primary" | "secondary" | "destructive" | "destructive-quiet" | "ghost";
  size?: "lg" | "md" | "sm";
  iconLeft?: string;
  iconRight?: string;
  fullWidth?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

/**
 * A navigation link styled identically to Button, for the (frequent) case of
 * a button-shaped control that goes to another route rather than submitting
 * a form — "Back to sign in", "Apply for a member account". Not part of the
 * source design system; added because Button is deliberately a plain
 * <button> only (see its own file), and several auth screens need this.
 */
export function ButtonLink({ href, variant = "primary", size = "md", iconLeft, iconRight, fullWidth = false, children, style, ...rest }: ButtonLinkProps) {
  const [hover, setHover] = React.useState(false);
  const base = BUTTON_VARIANTS[variant] || BUTTON_VARIANTS.primary;

  return (
    <Link
      href={href}
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
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out)",
        ...BUTTON_SIZES[size],
        ...base,
        ...(hover ? { background: BUTTON_HOVER[variant] } : null),
        ...style,
      }}
      {...rest}
    >
      {iconLeft && <Icon name={iconLeft} size="1.15em" />}
      <span>{children}</span>
      {iconRight && <Icon name={iconRight} size="1.15em" />}
    </Link>
  );
}
