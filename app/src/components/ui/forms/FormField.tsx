import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../core/Icon";

export interface FormFieldProps {
  /** Must match the control's id — wires up the label and error. */
  id: string;
  label: string;
  /** Helper text shown above the control, e.g. what a membership number looks like. */
  hint?: string;
  /** Validation message, normally straight from the Zod schema. */
  error?: string;
  required?: boolean;
  children: ReactNode;
  style?: CSSProperties;
}

/**
 * Label + hint + inline error shell shared by every input. The error
 * message is the one from the app's Zod schema, rendered verbatim under the
 * field — never as a toast, never only as a red border.
 */
export function FormField({ id, label, hint, error, required, children, style }: FormFieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)", ...style }}>
      <label htmlFor={id} style={{ font: "var(--type-body-strong)", color: "var(--text-strong)" }}>
        {label}
        {required && <span style={{ color: "var(--text-muted)", fontWeight: "var(--fw-regular)" }}> (required)</span>}
      </label>
      {hint && <p style={{ font: "var(--type-small)", color: "var(--text-muted)" }}>{hint}</p>}
      {children}
      {error && (
        <p
          id={id + "-error"}
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--sp-3)",
            font: "var(--type-small)",
            fontWeight: "var(--fw-semibold)",
            color: "var(--field-error-fg)",
          }}
        >
          <Icon name="warning-circle" size="16px" style={{ marginTop: 2 }} />
          {error}
        </p>
      )}
    </div>
  );
}

/** Shared control styling (48px tall, error-aware). Use when building a bespoke control. */
export const fieldStyle = (error?: string | boolean): CSSProperties => ({
  width: "100%",
  minHeight: "var(--control-h)",
  padding: "0 var(--sp-5)",
  background: error ? "var(--field-error-bg)" : "var(--field-bg)",
  color: "var(--text-body)",
  border: "var(--border-w) solid " + (error ? "var(--field-error-border)" : "var(--field-border)"),
  borderRadius: "var(--rx)",
  font: "var(--type-body)",
  outlineOffset: 2,
});
