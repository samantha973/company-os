import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { listOutcomesForActor } from "@/lib/portal/outcomes";
import { PageHead } from "@/components/admin/PageHead";
import { CoveragePanel } from "@/components/hub/CoveragePanel";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import type { OutcomeRow } from "@/lib/hub/outcomes";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "Coverage" };

// The client's coverage and LinkedIn posts: published rows only, read-only.
export default async function PortalCoveragePage({ searchParams }: { searchParams: SearchParamsObj }) {
  const actor = await requirePortalMember();
  const outcomes = await listOutcomesForActor(actor);
  const kind = firstParam(searchParams.kind) === "linkedin" ? "linkedin" : "coverage";

  // The read-only panel takes the full row shape; client-safe fields only are
  // populated, the internal ones are null by construction.
  const rows: OutcomeRow[] = outcomes.map((o) => ({
    id: o.id,
    kind: o.kind,
    channel: o.channel,
    title: o.title,
    outlet: o.outlet,
    url: o.url,
    publishDate: o.publishDate,
    publishedAt: o.publishDate,
    reach: o.reach,
    copyMd: o.copyMd,
    taskId: null,
    taskTitle: null,
    backlogItemId: null,
    targetTitle: o.targetTitle,
    journalistId: null,
    journalistName: null,
    caseStudyId: null,
    mediaAssetDocumentId: null,
    mediaAssetName: null,
    createdAt: o.publishDate ?? "",
  }));

  return (
    <div className="admin-content">
      <PageHead eyebrow="Client hub" title="Coverage" sub="Every piece we have secured for you, and the LinkedIn posts that went out." />
      <div className="admin-card admin-section-card">
        <CoveragePanel programId={outcomes[0]?.programId ?? ""} rows={rows} kind={kind} kindHref={(k) => `/portal/coverage?kind=${k}`} />
      </div>
    </div>
  );
}
