"use client";

import React from "react";
import type { CSSProperties, InputHTMLAttributes } from "react";
import { FormField, fieldStyle } from "./FormField";
import { Icon } from "../core/Icon";

export interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "style" | "id" | "type"> {
  id: string;
  /** Defaults to "Password". */
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  style?: CSSProperties;
}

/**
 * Password with a show/hide toggle. The toggle is a real 48px target
 * inside the field, because members type these on a phone with wet hands.
 */
export function PasswordField({ id, label = "Password", hint, error, required, style, ...rest }: PasswordFieldProps) {
  const [shown, setShown] = React.useState(false);
  const [focus, setFocus] = React.useState(false);
  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} style={style}>
      <div style={{ position: "relative", display: "flex" }}>
        <input
          id={id}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + "-error" : undefined}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            ...fieldStyle(error),
            paddingRight: "var(--tap-min)",
            borderColor: error ? "var(--field-error-border)" : focus ? "var(--border-focus)" : "var(--field-border)",
          }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "var(--tap-min)",
            height: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: 0,
            color: "var(--text-muted)",
            cursor: "pointer",
          }}
        >
          <Icon name={shown ? "eye-slash" : "eye"} size="20px" />
        </button>
      </div>
    </FormField>
  );
}
