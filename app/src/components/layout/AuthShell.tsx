import Image from "next/image";
import type { ReactNode } from "react";

export interface AuthShellProps {
  title: string;
  intro?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared shell for every sign-in-adjacent screen (login, register, pending,
 * forgot/reset password, accept-invite) — centered card, club logo, title +
 * intro. Mirrors the design system's ui_kits/member/AuthScreens.jsx AuthShell.
 */
export function AuthShell({ title, intro, children, footer }: AuthShellProps) {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--sp-7)",
        width: "100%",
        maxWidth: "var(--max-w-mobile)",
        margin: "0 auto",
        padding: "var(--sp-8) var(--gutter) var(--sp-10)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sp-5)", textAlign: "center" }}>
        <Image src="/logo.png" alt="" width={68} height={68} priority />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-2)" }}>
          <h1 style={{ font: "var(--type-h2)" }}>{title}</h1>
          {intro && <p style={{ font: "var(--type-small)", color: "var(--text-muted)" }}>{intro}</p>}
        </div>
      </div>
      {children}
      {footer}
    </main>
  );
}
