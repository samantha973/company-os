import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { getProgramDetail } from "@/lib/hub/program";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { CompanyDocuments, type ProgramOption } from "@/components/admin/CompanyDocuments";
import { MeetingsPanel } from "@/components/hub/MeetingsPanel";
import { setMeetingPublished, setMeetingProgram } from "@/app/admin/(dashboard)/revenue/meetings/actions";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import type { ProgramStatus } from "@/lib/hub/program";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "ok",
  paused: "warn",
  complete: "info",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The PR Program view: its boards, plus tagged documents and meetings. The
// plan, coverage, awards and pipeline live on the company's Client Hub tabs.
export default async function ProgramDetailPage({
  params,
  searchParams,
}: {
  params: { id: string; programId: string };
  searchParams: SearchParamsObj;
}) {
  const [detail, { data: companyRow }, { data: programRows }] = await Promise.all([
    getProgramDetail(params.id, params.programId),
    companyOs.from("companies").select("id, name").eq("id", params.id).maybeSingle(),
    companyOs.from("pr_programs").select("id, name").eq("company_id", params.id).order("created_at", { ascending: false }),
  ]);
  const company = companyRow as { id: string; name: string | null } | null;
  if (!detail || !company) notFound();

  const companyName = company.name || "(no name)";
  const programOptions = (programRows ?? []) as ProgramOption[];
  const hubHref = `/admin/revenue/companies/${company.id}?view=hub`;

  const tabs: TabDef[] = [
    {
      key: "boards",
      label: "Boards",
      count: detail.boards.length,
      content: (
        <section className="admin-card admin-section-card">
          {detail.boards.length === 0 ? (
            <Empty text="No active boards keyed to this program yet. Use “Set up Work Board” on the Client Hub." />
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
        eyebrow={<Link href={hubHref}>← {companyName}</Link>}
        title={detail.name}
        sub="Plan, coverage, awards and pipeline live on the Client Hub."
        action={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
            <Link className="admin-btn admin-btn--sm" href={`${hubHref}&tab=plan`}>Open Client Hub →</Link>
          </span>
        }
      />

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
