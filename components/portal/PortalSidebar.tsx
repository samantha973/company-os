"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, endAssumeSession } from "@/app/portal/(dashboard)/actions";
import { BRAND_PORTAL, BRAND_SHORT } from "@/lib/brand";

// Client-portal sibling of TeamSidebar: same admin shell CSS, flat nav. A nav
// item renders live only when its module has BOTH shipped (`built`) and the
// actor is entitled to it (design doc: "Team visible iff any company in scope
// has an active staff_assignments row", etc.) — otherwise it renders as a
// muted "soon" placeholder so the shell always looks complete without dead
// links. Modules with no `entitlementKey` (Home) are always live once built.
export type PortalEntitlements = {
  team: boolean;
  timeOff: boolean;
  invoices: boolean;
  meetings: boolean;
  board: boolean;
  plan: boolean;
  coverage: boolean;
  awards: boolean;
  caseStudies: boolean;
  users: boolean;
  companyProfile: boolean;
};

type EntitlementKey = keyof PortalEntitlements;
type NavItem = { label: string; href: string; ico: string; built?: boolean; entitlementKey?: EntitlementKey };

type NavGroup = { label: string | null; items: NavItem[] };

// Three sections: the work (Delivery), the people on it (People), and the
// client's own record (Account). Groups collapse, matching AdminSidebar. Home
// stays ungrouped and renders as a top-level landmark: same accent bar and
// type as a section header, since it outranks the items inside the sections.
// Four items, flat. The Hub (/portal) mirrors the admin Client Hub \u2014 plan,
// activity, coverage, awards, case studies, documents, meetings and invoices
// are its tabs, not nav entries. Everything else the portal can do (requests,
// referrals, time off, users) stays reachable by URL but out of the nav.
const NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "The Hub", href: "/portal", ico: "\u25a6", built: true },
      // "Your PR Hub team" not "Team": the agency staff assigned to the client.
      { label: `Your ${BRAND_SHORT} team`, href: "/portal/team", ico: "\u2637", built: true, entitlementKey: "team" },
      // Personal Profile is self-scoped, so every role gets it, always.
      { label: "Personal Profile", href: "/portal/profile", ico: "\u25c9", built: true },
      // Company Profile edits the shared company record: admins only.
      { label: "Company Profile", href: "/portal/company", ico: "\u2302", built: true, entitlementKey: "companyProfile" },
    ],
  },
];

// Nav starts fully collapsed: every labeled group is closed on load, so the
// sidebar shows only the section labels until the user clicks one open.
function buildCollapsed(): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const group of NAV) if (group.label) map[group.label] = true;
  return map;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const raw = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return raw.toUpperCase();
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/portal") return pathname === "/portal" || pathname === "/portal/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalSidebar({
  name,
  companyName,
  entitlements,
  impersonating = false,
}: {
  name: string;
  companyName: string | null;
  entitlements: PortalEntitlements;
  // While an admin is viewing via Assume, the account menu ends the Assume
  // session instead of signing out — this is the admin's REAL session
  // underneath, not the client's, so a plain "Sign out" here would be wrong
  // (and confusing) rather than just ending the view-as.
  impersonating?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(buildCollapsed);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  function toggleGroup(key: string) {
    setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  }

  useEffect(() => {
    if (!profileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setProfileMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profileMenuOpen]);

  const isEnabled = (item: NavItem) =>
    !!item.built && (!item.entitlementKey || entitlements[item.entitlementKey]);

  return (
    <>
      <div className="admin-mobilebar">
        <button
          className="admin-mobile-toggle"
          aria-label="Open navigation"
          onClick={() => setNavOpen(true)}
        >
          ☰
        </button>
        <strong>{BRAND_PORTAL}</strong>
      </div>

      {navOpen && <div className="admin-scrim" onClick={() => setNavOpen(false)} />}

      <nav className={`admin-sidebar admin-portal-sidebar${navOpen ? " is-open" : ""}`} aria-label="Portal">
        <div className="admin-brand">
          <span className="admin-brand-lead">{BRAND_PORTAL}</span>
          <span className="admin-brand-actions">
            <button
              type="button"
              className="admin-avatarbtn"
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              aria-label="Your account"
              onClick={() => setProfileMenuOpen((v) => !v)}
            >
              {initials(name)}
            </button>
          </span>
        </div>

        {profileMenuOpen && (
          <div className="admin-profilemenu-backdrop" onClick={() => setProfileMenuOpen(false)} />
        )}
        {profileMenuOpen && (
          <div className="admin-profilemenu" role="menu" aria-label="Your account">
            <div className="admin-profilemenu-head">
              <span className="admin-avatarbtn admin-avatarbtn--lg" aria-hidden>
                {initials(name)}
              </span>
              {/* Name only: the company already sits under the brand as the
                  section label, and this slot's break-all (built for emails)
                  hyphenates a company name mid-word. */}
              <span className="admin-profilemenu-email">{name}</span>
            </div>

            <div className="admin-profilemenu-sep" />

            <form action={impersonating ? endAssumeSession : signOut}>
              <button type="submit" className="admin-signout admin-profilemenu-signout">
                {impersonating ? "Exit assume mode" : "Sign out"}
              </button>
            </form>
          </div>
        )}

        <div className="admin-nav" onClick={() => setNavOpen(false)}>
          {companyName && <div className="admin-nav-sectlabel">{companyName}</div>}
          {NAV.map((group, gi) => {
            const isCollapsed = Boolean(group.label && collapsed[group.label]);
            return (
              <div className="admin-nav-group" key={group.label ?? `g${gi}`}>
                {group.label && (
                  <button
                    className="admin-nav-grouplabel admin-nav-grouptoggle"
                    aria-expanded={!isCollapsed}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroup(group.label as string);
                    }}
                  >
                    {group.label}
                    <span className={`admin-nav-caret${isCollapsed ? " is-collapsed" : ""}`} aria-hidden>
                      ▾
                    </span>
                  </button>
                )}
                {!isCollapsed &&
                  group.items.map((item) =>
                    isEnabled(item) ? (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`admin-nav-link${isActive(pathname, item.href) ? " is-active" : ""}`}
                      >
                        <span className="admin-nav-ico" aria-hidden>
                          {item.ico}
                        </span>
                        {item.label}
                      </Link>
                    ) : (
                      <span
                        key={item.href}
                        className="admin-nav-link u-disabled"
                        aria-disabled
                        title="Coming soon"
                      >
                        <span className="admin-nav-ico" aria-hidden>
                          {item.ico}
                        </span>
                        {item.label}
                        <span className="admin-nav-badge">soon</span>
                      </span>
                    ),
                  )}
              </div>
            );
          })}
        </div>

      </nav>
    </>
  );
}
