import type { CSSProperties } from "react";
import { Icon } from "../core/Icon";
import { Button } from "../buttons/Button";

export interface ErrorStateProps {
  title?: string;
  body?: string;
  onRetry?: () => void;
  style?: CSSProperties;
}

/**
 * Fetch failure. Distinguishes "we couldn't load this" from "there is
 * nothing here" — spec 10/11 both expect a clear error rather than an
 * empty screen.
 */
export function ErrorState({
  title = "We couldn't load this just now",
  body = "Please check your connection and try again. If it keeps happening, the club can still take your booking by phone.",
  onRetry,
  style,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "var(--sp-5)",
        padding: "var(--sp-10) var(--sp-6)",
        background: "var(--status-rejected-bg)",
        border: "var(--border-w) solid var(--status-rejected-border)",
        borderRadius: "var(--rx)",
        color: "var(--status-rejected-fg)",
        ...style,
      }}
    >
      <Icon name="cloud-warning" weight="regular" size="34px" />
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", maxWidth: 400 }}>
        <strong style={{ font: "var(--type-h3)", color: "inherit" }}>{title}</strong>
        <p style={{ font: "var(--type-small)" }}>{body}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" iconLeft="arrow-clockwise" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
