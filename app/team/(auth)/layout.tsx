import type { Metadata } from "next";
import "../../admin/admin.css";
import { BRAND_TEAM } from "@/lib/brand";

// Bare, UN-gated auth shell so /team/login is reachable without a session. The
// (dashboard) group carries the requireTeamMember() gate.
export const metadata: Metadata = {
  title: `Sign in · ${BRAND_TEAM}`,
  robots: { index: false, follow: false },
};

export default function TeamAuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
