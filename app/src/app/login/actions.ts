"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/auth";

const ERROR_MESSAGES: Record<string, string> = {
  "invalid-credentials": "Incorrect email or password.",
  "awaiting-activation":
    "This account is awaiting activation — check your email for an invite link, or ask the club to resend it.",
  "pending-approval": "Your registration is still pending admin approval.",
  rejected: "Your registration was not approved. Contact the club if you believe this is a mistake.",
  deactivated: "This account has been deactivated. Contact the club.",
};

export async function loginAction(_prevState: string | undefined, formData: FormData) {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // Auth.js throws a special redirect error on success — let that (and
    // anything not an AuthError) propagate rather than swallowing it here.
    // Note: AuthError.type is always the fixed string "CredentialsSignin" for
    // this whole error family — the actual distinguishing info is `.code`,
    // which is what we set to a specific value on each subclass in auth.ts.
    if (error instanceof CredentialsSignin) {
      return ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES["invalid-credentials"];
    }
    if (error instanceof AuthError) {
      return ERROR_MESSAGES["invalid-credentials"];
    }
    throw error;
  }
}
