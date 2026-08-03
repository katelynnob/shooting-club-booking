"use client";

import React from "react";
import type { CSSProperties, SelectHTMLAttributes } from "react";
import { FormField, fieldStyle } from "./FormField";
import { Icon } from "../core/Icon";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "style" | "id"> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  options: SelectOption[];
  /** Empty first option, e.g. "Choose a range". */
  placeholder?: string;
  style?: CSSProperties;
}

export function SelectField({ id, label, hint, error, required, options = [], placeholder, style, ...rest }: SelectFieldProps) {
  const [focus, setFocus] = React.useState(false);
  return (
    <FormField id={id} label={label} hint={hint} error={error} required={required} style={style}>
      <div style={{ position: "relative", display: "flex" }}>
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? id + "-error" : undefined}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            ...fieldStyle(error),
            appearance: "none",
            paddingRight: "var(--tap-min)",
            borderColor: error ? "var(--field-error-border)" : focus ? "var(--border-focus)" : "var(--field-border)",
          }}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="caret-down"
          size="18px"
          style={{
            position: "absolute",
            right: "var(--sp-5)",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}
        />
      </div>
    </FormField>
  );
}
