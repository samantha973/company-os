import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { listCaseStudiesForActor } from "@/lib/portal/supporting";
import { getPlanTabForActor } from "@/lib/portal/plan";
import { resolvePlanScope, scopeCaseStudies, scopeParam } from "@/lib/hub/scope";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { PageHead } from "@/components/admin/PageHead";
import { CaseStudiesPanel } from "@/components/hub/CaseStudiesPanel";
import { PlanScopeSwitch } from "@/components/hub/PlanScopeSwitch";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: "Case studies" };

export default async function PortalCaseStudiesPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const actor = await requirePortalMember();
  const [rows, plan] = await Promise.all([listCaseStudiesForActor(actor), getPlanTabForActor(actor)]);
  const scope = resolvePlanScope(plan?.plans ?? [], firstParam(searchParams.plan));
  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Client hub"
        title="Case studies"
        sub="Customer stories we can offer to media, and where they have run."
        action={plan ? <PlanScopeSwitch plans={plan.plans.map((p) => ({ id: p.id, label: p.quarter_label }))} value={scopeParam(scope)} /> : undefined}
      />
      <div className="admin-card admin-section-card">
        <CaseStudiesPanel programId="" rows={scopeCaseStudies(rows, scope)} />
      </div>
    </div>
  );
}
