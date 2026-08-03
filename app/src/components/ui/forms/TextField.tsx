"use client";

import React from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";
import { FormField, fieldStyle } from "./FormField";

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "id" | "type"> {
  id: string;
  label: string;
  hint?: string;
  /** Inline validation message from the Zod schema, e.g. "Membership number is required". */
  error?: string;
  required?: boolean;
  type?: "text" | "email" | "tel" | "number" | "search";
  style?: CSSProperties;
}

export function TextField({ id, label, hint, error, required, type = "text", inputMode, style, ...rest }: TextFieldProps) {
  const [focus, setFocus] = React.useState(false);
  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} style={style}>
      <input
        id={id}
        type={type}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? id + "-error" : undefined}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          ...fieldStyle(error),
          borderColor: error
            ? "var(--field-error-border)"
            : focus
              ? "var(--border-focus)"
              : "var(--field-border)",
        }}
        {...rest}
      />
    </FormField>
  );
}
