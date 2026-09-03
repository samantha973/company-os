import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { listCaseStudiesForActor } from "@/lib/portal/supporting";
import { PageHead } from "@/components/admin/PageHead";
import { CaseStudiesPanel } from "@/components/hub/CaseStudiesPanel";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "Case studies" };

export default async function PortalCaseStudiesPage() {
  const actor = await requirePortalMember();
  const rows = await listCaseStudiesForActor(actor);
  return (
    <div className="admin-content">
      <PageHead eyebrow="Client hub" title="Case studies" sub="Customer stories we can offer to media, and where they have run." />
      <div className="admin-card admin-section-card">
        <CaseStudiesPanel programId="" rows={rows} />
      </div>
    </div>
  );
}
