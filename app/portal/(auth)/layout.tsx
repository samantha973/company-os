import type { Metadata } from "next";
import "../../admin/admin.css";
import { BRAND_PORTAL } from "@/lib/brand";

// Bare, UN-gated auth shell so /portal/login is reachable without a session.
// The (dashboard) group carries the requirePortalMember() gate.
export const metadata: Metadata = {
  title: `Sign in · ${BRAND_PORTAL}`,
  robots: { index: false, follow: false },
};

export default function PortalAuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
