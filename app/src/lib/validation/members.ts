import { z } from "zod";

// Shared building blocks — kept in sync everywhere they're used, per
// specs/01-accounts-and-ranges.md's registration/invite requirements.
const email = z.string().trim().toLowerCase().email();
const name = z.string().trim().min(1, "Name is required");
const membershipNumber = z.string().trim().min(1, "Membership number is required");
const password = z.string().min(8, "Password must be at least 8 characters");

export const registerSchema = z.object({
  email,
  password,
  name,
  membershipNumber,
});

// Same fields as registration minus a password — spec 01, Admin-invited accounts.
export const inviteMemberSchema = z.object({
  email,
  name,
  membershipNumber,
});

// PATCH /api/admin/members/:id — any subset, but not an empty body.
export const patchMemberSchema = z
  .object({
    email: email.optional(),
    name: name.optional(),
    membershipNumber: membershipNumber.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const rejectMemberSchema = z.object({
  rejectedReason: z.string().trim().optional(),
});

export const setRsoSchema = z.object({
  isRso: z.boolean(),
});

export const setAdminSchema = z.object({
  isAdmin: z.boolean(),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: password,
});

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password,
});
