import type { MemberStatus } from "@/generated/prisma/enums";

// Augments Auth.js's built-in types with the claims this system actually
// needs on every request (role/status checks, the sessionVersion revocation
// check) — see src/auth.ts and specs/01-accounts-and-ranges.md.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      status: MemberStatus;
      isRso: boolean;
      isAdmin: boolean;
      isSuperAdmin: boolean;
    };
  }

  interface User {
    status: MemberStatus;
    isRso: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    sessionVersion: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    status?: MemberStatus;
    isRso?: boolean;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    sessionVersion?: number;
  }
}
