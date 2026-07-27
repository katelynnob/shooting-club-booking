import { z } from "zod";

// Shared by src/auth.ts (login) and, later, the registration/invite endpoints
// in specs/01-accounts-and-ranges.md — the email-normalization rule (trim +
// lowercase before comparison) must be identical everywhere it's used.
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
