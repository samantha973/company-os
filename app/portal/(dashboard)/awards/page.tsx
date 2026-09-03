import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { listAwardsForActor } from "@/lib/portal/supporting";
import { PageHead } from "@/components/admin/PageHead";
import { AwardsPanel } from "@/components/hub/AwardsPanel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "Awards" };

export default async function PortalAwardsPage() {
  const actor = await requirePortalMember();
  const rows = await listAwardsForActor(actor);
  return (
    <div className="admin-content">
      <PageHead eyebrow="Client hub" title="Awards" sub="Entries we have proposed, agreed and submitted on your behalf." />
      <div className="admin-card admin-section-card">
        <AwardsPanel programId="" rows={rows} />
      </div>
    </div>
  );
}
