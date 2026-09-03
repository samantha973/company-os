"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ALL_TIME } from "@/lib/hub/scope";

// The hub's range switch: All time, or one 90-Day Plan. Writes `?plan=` on
// the current URL and keeps every other param (tab, kind…), so the choice
// follows the reader across tabs and survives a shared link.

export type ScopeChip = { id: string; label: string; draft?: boolean };

// `value` is the resolved scope when the server knows it; layouts (which
// cannot read search params) pass `defaultValue` and the URL decides.
export function PlanScopeSwitch({ plans, value: given, defaultValue }: { plans: ScopeChip[]; value?: string; defaultValue?: string }) {
  const pathname = usePathname() ?? "";
  const params = useSearchParams();
  const fromUrl = params?.get("plan");
  const value = given ?? (fromUrl && (fromUrl === ALL_TIME || plans.some((p) => p.id === fromUrl)) ? fromUrl : defaultValue ?? ALL_TIME);
  const href = (plan: string) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("plan", plan);
    return `${pathname}?${next.toString()}`;
  };
  const chips: ScopeChip[] = [{ id: ALL_TIME, label: "All time" }, ...plans];
  return (
    // A div, not <nav>: globals.css pins the public site's <nav> to the top of
    // the viewport and that rule reaches the OS surfaces too.
    <div className="admin-scope-switch" role="navigation" aria-label="Plan range">
      {chips.map((c) => (
        <Link key={c.id} href={href(c.id)} className={`admin-chip${c.id === value ? " is-active" : ""}`} aria-current={c.id === value ? "true" : undefined}>
          {c.label}
          {c.draft && <span className="admin-cell-muted"> · draft</span>}
        </Link>
      ))}
    </div>
  );
}
