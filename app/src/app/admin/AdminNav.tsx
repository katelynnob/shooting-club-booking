"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/core/Icon";

const NAV = [
  { href: "/admin/members", label: "Members", icon: "users-three" },
  { href: "/admin/ranges", label: "Ranges", icon: "target" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
      {NAV.map((n) => {
        const on = pathname?.startsWith(n.href) ?? false;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--sp-4)",
              minHeight: "var(--tap-min)",
              padding: "0 var(--sp-5)",
              textAlign: "left",
              background: on ? "var(--surface-selected)" : "transparent",
              color: on ? "var(--action-secondary-fg)" : "var(--text-body)",
              border: "var(--border-w) solid " + (on ? "var(--action-secondary-border)" : "transparent"),
              borderRadius: "var(--rx)",
              font: "var(--type-body-strong)",
              fontSize: "var(--fs-sm)",
              textDecoration: "none",
            }}
          >
            <Icon name={n.icon} size="19px" weight={on ? "fill" : "bold"} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
