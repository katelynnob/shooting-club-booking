"use client";

import React from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Small explanatory bubble, used mainly to explain why an action is
 * unavailable ("Cancellation window closed"). It opens on hover, on keyboard
 * focus AND on tap, because on a phone there is no hover — a reason a
 * member can't read is the same as no reason at all.
 */
export interface TooltipProps {
  /** The explanation. Keep it to one sentence in club voice. */
  text: string;
  placement?: "top" | "bottom";
  children: ReactNode;
  style?: CSSProperties;
}

export function Tooltip({ text, placement = "top", children, style }: TooltipProps) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const vertical = placement === "top" ? { bottom: "calc(100% + 8px)" } : { top: "calc(100% + 8px)" };

  return (
    <span
      style={{ position: "relative", display: "inline-flex", ...style }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((v) => !v)}
    >
      <span aria-describedby={open ? id : undefined} style={{ display: "inline-flex" }}>
        {children}
      </span>
      {open && (
        <span
          id={id}
          role="tooltip"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            ...vertical,
            zIndex: 20,
            minWidth: 160,
            maxWidth: 260,
            padding: "8px 10px",
            background: "var(--surface-inverse)",
            color: "var(--text-inverse)",
            font: "var(--type-small)",
            borderRadius: "var(--rx)",
            boxShadow: "var(--shadow-pop)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
