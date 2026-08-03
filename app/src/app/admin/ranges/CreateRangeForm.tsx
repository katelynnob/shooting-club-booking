"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/forms/TextField";
import { Button } from "@/components/ui/buttons/Button";
import { InlineAlert } from "@/components/ui/feedback/InlineAlert";
import { createRangeAction } from "./actions";

export function CreateRangeForm() {
  const [error, formAction, pending] = useActionState(createRangeAction, undefined);

  return (
    <form action={formAction} style={{ display: "flex", gap: "var(--sp-5)", alignItems: "flex-end", flexWrap: "wrap" }}>
      <TextField id="range-name" name="name" label="Name" required style={{ minWidth: 160 }} />
      <TextField id="range-discipline" name="discipline" label="Discipline" required style={{ minWidth: 160 }} />
      <TextField id="range-capacity" name="capacity" label="Capacity" type="number" min={1} required style={{ minWidth: 100 }} />
      <Button type="submit" iconLeft="plus" loading={pending}>
        {pending ? "Creating…" : "Create range"}
      </Button>
      {error && (
        <InlineAlert tone="danger" style={{ width: "100%" }}>
          {error}
        </InlineAlert>
      )}
    </form>
  );
}
