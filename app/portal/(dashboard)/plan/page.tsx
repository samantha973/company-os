import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { getPlanTabForActor } from "@/lib/portal/plan";
import { PageHead } from "@/components/admin/PageHead";
import { QuarterlyPlanPanel } from "@/components/hub/QuarterlyPlanPanel";
import { quarterFor } from "@/lib/pr/quarters";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "90-Day Plan" };

// The client's view of the 90-day plan: published quarters only, read-only,
// with the honest "where it stands" note on anything that slipped.
export default async function PortalPlanPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const actor = await requirePortalMember();
  const tab = await getPlanTabForActor(actor, firstParam(searchParams.plan));

  return (
    <div className="admin-content">
      <PageHead eyebrow="Client hub" title="90-Day Plan" sub="What we agreed for the quarter, and where each target stands." />
      {tab ? (
        <QuarterlyPlanPanel
          programId={tab.programId}
          plans={tab.plans}
          selected={tab.selected}
          targets={tab.targets}
          groups={tab.groups}
          planHrefBase="/portal/plan?plan="
          suggestNext={quarterFor(new Date())}
        />
      ) : (
        <div className="admin-card admin-section-card">
          <div className="admin-empty">Your 90-day plan will appear here once it is published.</div>
        </div>
      )}
    </div>
  );
}
