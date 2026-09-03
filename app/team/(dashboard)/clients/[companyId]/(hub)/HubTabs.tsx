"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Client hub tab nav for a PR program. Active state from the pathname: exact
// match for Overview, prefix match for the subroutes. The plan-scope param
// (?plan=) travels with every tab link so the chosen range sticks.

const TABS = [
  { href: "", label: "Overview" },
  { href: "/plan", label: "90-Day Plan" },
  { href: "/board", label: "Work Board" },
  { href: "/coverage", label: "Coverage" },
  { href: "/awards", label: "Awards" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/documents", label: "Documents" },
  { href: "/meetings", label: "Meetings" },
  { href: "/team", label: "Team" },
];

export function HubTabs({ base }: { base: string }) {
  const pathname = (usePathname() ?? "").replace(/\/$/, "");
  const plan = useSearchParams()?.get("plan");
  const suffix = plan ? `?plan=${encodeURIComponent(plan)}` : "";
  return (
    <nav className="admin-tabs">
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const active = t.href === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link key={t.label} href={`${href}${suffix}`} className={`admin-tab${active ? " is-active" : ""}`}>
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
