import type { Metadata } from "next";
import { requireTeamMember } from "@/lib/team-auth";
import { hasClientAssignments } from "@/lib/team/clients";
import { TeamSidebar } from "@/components/team/TeamSidebar";
import { TeamChatWidget } from "@/components/team/TeamChatWidget";
import "../../admin/admin.css";
import { BRAND_SHORT, BRAND_TEAM } from "@/lib/brand";

export const metadata: Metadata = {
  title: { template: `%s · ${BRAND_TEAM}`, default: BRAND_TEAM },
  description: `Your ${BRAND_SHORT} team workspace.`,
  robots: { index: false, follow: false },
};

export default async function TeamDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireTeamMember();
  const hasClients = await hasClientAssignments(actor);

  return (
    <div className="admin-shell">
      <TeamSidebar
        name={actor.displayName}
        avatarUrl={actor.avatarUrl}
        isAdmin={actor.isAdmin}
        hasClients={hasClients}
      />
      <main className="admin-main">{children}</main>
      <TeamChatWidget />
    </div>
  );
}
