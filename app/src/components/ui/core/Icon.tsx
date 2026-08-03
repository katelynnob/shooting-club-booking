import type { CSSProperties } from "react";

/**
 * Phosphor glyph wrapper. The icon font is loaded globally via globals.css
 * — see readme.md ICONOGRAPHY in the design system project. Decorative by
 * default (aria-hidden); pass `label` when the icon is the only thing
 * conveying meaning.
 */
export interface IconProps {
  /** Phosphor icon name, e.g. "shield-check". */
  name: string;
  weight?: "regular" | "bold" | "fill";
  size?: string;
  color?: string;
  label?: string;
  style?: CSSProperties;
}

export function Icon({ name, weight = "bold", size = "1em", color, label, style, ...rest }: IconProps) {
  const cls = weight === "regular" ? "ph" : "ph-" + weight;
  return (
    <i
      className={cls + " ph-" + name}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      style={{ fontSize: size, color, lineHeight: 1, display: "inline-block", flex: "none", ...style }}
      {...rest}
    ></i>
  );
}
