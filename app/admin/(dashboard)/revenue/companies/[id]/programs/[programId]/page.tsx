import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { getProgramDetail } from "@/lib/hub/program";
import { getLiveCardItemIds } from "@/lib/admin/company-hub";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { CompanyDocuments, type ProgramOption } from "@/components/admin/CompanyDocuments";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { setMeetingPublished, setMeetingProgram } from "@/app/admin/(dashboard)/revenue/meetings/actions";
import { BacklogAdminEditor } from "@/app/admin/(dashboard)/edges/client-roadmaps/BacklogAdminEditor";
import { OverviewEditor } from "@/app/admin/(dashboard)/edges/client-roadmaps/OverviewEditor";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import type { ProgramStatus } from "@/lib/hub/program";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "ok",
  complete: "info",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The PR Program view (Client Hub by PR Program, PR 1): one program = one
// roadmap = its work boards, plus tagged documents and meetings. Data comes
// from lib/hub/program.ts.
export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; programId: string };
  searchParams: SearchParamsObj;
}) {
  const [detail, { data: companyRow }, { data: programRows }, { data: overviewRow }] = await Promise.all([
    getProgramDetail(params.id, params.programId),
    companyOs.from("companies").select("id, name").eq("id", params.id).maybeSingle(),
    companyOs.from("pr_programs").select("id, name").eq("company_id", params.id).order("created_at", { ascending: false }),
    companyOs.from("client_roadmap_overview").select("body").eq("company_id", params.id).maybeSingle(),
  ]);
  const company = companyRow as { id: string; name: string | null } | null;
  if (!detail || !company) notFound();

  const companyName = company.name || "(no name)";
  const overviewBody = (overviewRow as { body: string } | null)?.body ?? "";
  const programOptions = (programRows ?? []) as ProgramOption[];

  const liveCardItemIds = await getLiveCardItemIds(detail.roadmapItems.map((i) => i.id));

  const tabs: TabDef[] = [
    {
      key: "roadmap",
      label: "Roadmap",
      count: detail.roadmapItems.length,
      content: (
        <>
          <OverviewEditor companyId={company.id} initialBody={overviewBody} />
          <BacklogAdminEditor
            companyId={company.id}
            groups={detail.roadmapGroups}
            items={detail.roadmapItems}
            programs={programOptions}
            showArchived={false}
            liveCardItemIds={liveCardItemIds}
            defaultProgramId={detail.id}
          />
        </>
      ),
    },
    {
      key: "boards",
      label: "Boards",
      count: detail.boards.length,
      content: (
        <section className="admin-card admin-section-card">
          {detail.boards.length === 0 ? (
            <Empty text="No active boards keyed to this program yet. Link one from Work Boards." />
          ) : (
            <div className="admin-list">
              {detail.boards.map((b) => (
                <div className="admin-list-row" key={b.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">
                      <Link href={`/admin/boards/${b.slug}`}>{b.name}</Link>
                    </div>
                    <div className="admin-list-sub">
                      {b.cardCount} {b.cardCount === 1 ? "card" : "cards"}
                    </div>
                  </div>
                  <div className="admin-list-aside">
                    <Link className="admin-btn admin-btn--sm" href={`/admin/boards/${b.slug}`}>
                      Open board
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ),
    },
    {
      key: "documents",
      label: "Documents",
      count: detail.documents.length,
      content: (
        <section className="admin-card admin-section-card">
          <CompanyDocuments
            companyId={company.id}
            documents={detail.documents}
            programs={programOptions}
            defaultProgramId={detail.id}
          />
        </section>
      ),
    },
    {
      key: "meetings",
      label: "Meetings",
      count: detail.meetings.length,
      content: (
        <section className="admin-card admin-section-card">
          <MeetingsPanel
            meetings={detail.meetings}
            publishAction={setMeetingPublished}
            programAction={setMeetingProgram}
            programOptions={programOptions}
          />
        </section>
      ),
    },
  ];

  return (
    <div>
      <PageHead
        eyebrow={<Link href={`/admin/revenue/companies/${company.id}?view=hub`}>← {companyName}</Link>}
        title={detail.name}
        sub={detail.githubRepo ?? undefined}
        action={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{/* layout-ok: mirrors the company 360 badge row verbatim */}
            <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
            {detail.githubRepo && <Badge tone="neutral">{detail.githubRepo}</Badge>}
          </span>
        }
      />

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
