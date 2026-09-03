import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { requireTeamMember } from "@/lib/team-auth";
import { getActorClientCompanies, getActorEmail, getProgramDetailForActor } from "@/lib/team/clients";
import { type ProgramStatus } from "@/lib/hub/program";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { MeetingsPanel, type ProgramOption } from "@/components/hub/MeetingsPanel";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { ClientDocumentsList } from "../../(hub)/ClientDocumentsList";
import { publishMeeting, setMeetingProgram } from "../../(hub)/meetings/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "PR Program" };

const STATUS_TONE: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "ok",
  paused: "warn",
  complete: "info",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The team PR Program view: its boards, tagged documents and meetings. The
// plan, coverage, awards and pipeline live on the client hub tabs.
// Authorization mirrors the hub layout: the company must be in the actor's
// active staff assignments, and the program must belong to that company;
// either miss is a 404.
export default async function TeamProgramDetailPage({
  params,
  searchParams,
}: {
  params: { companyId: string; programId: string };
  searchParams: SearchParamsObj;
}) {
  const actor = await requireTeamMember();

  const [companies, detail, actorEmail] = await Promise.all([
    getActorClientCompanies(actor),
    getProgramDetailForActor(actor, params.companyId, params.programId),
    getActorEmail(actor),
  ]);
  const company = companies.find((c) => c.id === params.companyId);
  if (!company || !detail) notFound();

  const { data: programRows } = await companyOs
    .from("pr_programs")
    .select("id, name")
    .eq("company_id", params.companyId)
    .order("created_at", { ascending: false });
  const programOptions = (programRows ?? []) as ProgramOption[];
  const hubHref = `/team/clients/${company.id}`;

  const tabs: TabDef[] = [
    {
      key: "boards",
      label: "Boards",
      count: detail.boards.length,
      content: (
        <section className="admin-card admin-section-card">
          {detail.boards.length === 0 ? (
            <Empty text="No active boards keyed to this program yet." />
          ) : (
            <div className="admin-list">
              {detail.boards.map((b) => (
                <div className="admin-list-row" key={b.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">
                      <Link href={`/team/boards/${b.slug}`}>{b.name}</Link>
                    </div>
                    <div className="admin-list-sub">
                      {b.cardCount} {b.cardCount === 1 ? "card" : "cards"}
                    </div>
                  </div>
                  <div className="admin-list-aside">
                    <Link className="admin-btn admin-btn--sm" href={`/team/boards/${b.slug}`}>
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
          <ClientDocumentsList
            documents={detail.documents}
            companyId={company.id}
            actorEmail={actorEmail}
            programId={detail.id}
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
            publishAction={publishMeeting}
            programAction={setMeetingProgram}
            programOptions={programOptions}
          />
        </section>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <PageHead
        eyebrow={<Link href={hubHref}>← {company.name}</Link>}
        title={detail.name}
        sub="Plan, coverage, awards and pipeline live on the client hub tabs."
        action={
          <span className="u-row u-wrap">
            <Badge tone={STATUS_TONE[detail.status]}>{detail.status}</Badge>
            <Link className="admin-btn admin-btn--sm" href={`${hubHref}/plan`}>90-Day Plan →</Link>
          </span>
        }
      />

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
