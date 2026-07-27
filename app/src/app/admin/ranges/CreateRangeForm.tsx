"use client";

import { useActionState } from "react";
import { createRangeAction } from "./actions";

export function CreateRangeForm() {
  const [error, formAction, pending] = useActionState(createRangeAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      <label>
        Name
        <input name="name" required style={{ display: "block" }} />
      </label>
      <label>
        Discipline
        <input name="discipline" required style={{ display: "block" }} />
      </label>
      <label>
        Capacity
        <input name="capacity" type="number" min={1} required style={{ display: "block", width: 80 }} />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create range"}
      </button>
      {error && <p style={{ color: "crimson", width: "100%" }}>{error}</p>}
    </form>
  );
}
