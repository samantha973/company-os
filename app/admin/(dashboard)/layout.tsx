import type { Metadata } from "next";
import { requireAdmin, isSuperAdmin } from "@/lib/admin-auth";
import { hasTeamAccess } from "@/lib/team-auth";
import { avatarUrlForAuthUser } from "@/lib/avatars";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminChatWidget } from "@/components/admin/AdminChatWidget";
import { isPrivilegedChatUser } from "@/lib/admin-chat/privileged";
import "../admin.css";
import { BRAND, PRODUCT } from "@/lib/brand";

export const metadata: Metadata = {
  title: { template: `%s · ${BRAND}`, default: BRAND },
  description: `${BRAND} · built on ${PRODUCT}`,
  robots: { index: false, follow: false },
};

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const [canSwitchToTeam, avatarUrl, superAdmin] = await Promise.all([
    hasTeamAccess(user.id),
    avatarUrlForAuthUser(user.id),
    isSuperAdmin(user.email),
  ]);

  return (
    <div className="admin-shell">
      <AdminSidebar
        user={user}
        avatarUrl={avatarUrl}
        canSwitchToTeam={canSwitchToTeam}
        isSuperAdmin={superAdmin}
      />
      <main className="admin-main">{children}</main>
      <AdminChatWidget canWrite={isPrivilegedChatUser(user.email)} />
    </div>
  );
}
