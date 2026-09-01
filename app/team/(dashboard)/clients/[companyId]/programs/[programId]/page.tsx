import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { requireTeamMember } from "@/lib/team-auth";
import {
  getActorClientCompanies,
  getActorEmail,
  getProgramDetailForActor,
} from "@/lib/team/clients";
import { type ProgramStatus } from "@/lib/hub/program";
import { ROADMAP_GROUPS_SELECT, type RoadmapGroup } from "@/lib/client-backlog";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { BotText } from "@/components/assistant/BotText";
import { MeetingsPanel, type ProgramOption } from "@/components/hub/MeetingsPanel";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { ClientDocumentsList } from "../../(hub)/ClientDocumentsList";
import { AddItemForm } from "../../(hub)/roadmap/AddItemForm";
import { RoadmapItemCard } from "../../(hub)/roadmap/RoadmapItemCard";
import { ROADMAP_STYLES } from "../../(hub)/roadmap/styles";
import { publishMeeting, setMeetingProgram } from "../../(hub)/meetings/actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "PR Program" };

const STATUS_TONE: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "ok",
  complete: "info",
};

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The team PR Program view, mirroring the admin program view (Roadmap / Boards
// / Documents / Meetings) with team affordances: roadmap add/edit as the team
// roadmap tab allows, boards linking to the team board routes, the team
// publish/tag meeting actions, and the team documents list. Authorization
// mirrors the hub layout: the company must be in the actor's active staff
// assignments, and the program must belong to that company; either miss is a
// 404.
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

  // The company's programs (Meetings tag options) and its full group list
  // (Add-item options: the program's own groups plus every company-wide one,
  // so the first program item can land under a company-wide section too).
  const [{ data: programRows }, { data: groupRows }, { data: overviewRow }] = await Promise.all([
    companyOs.from("pr_programs").select("id, name").eq("company_id", params.companyId).order("created_at", { ascending: false }),
    companyOs.from("client_roadmap_groups").select(ROADMAP_GROUPS_SELECT).eq("company_id", params.companyId).is("archived_at", null).order("sort_order", { ascending: true }),
    companyOs.from("client_roadmap_overview").select("body").eq("company_id", params.companyId).maybeSingle(),
  ]);
  const programOptions = (programRows ?? []) as ProgramOption[];
  const allGroups = (groupRows ?? []) as unknown as RoadmapGroup[];
  const addableGroups = allGroups.filter((g) => g.pr_program_id === detail.id || g.pr_program_id === null);
  const overview = ((overviewRow as { body: string } | null)?.body ?? "").trim() || null;

  const tabs: TabDef[] = [
    {
      key: "roadmap",
      label: "Roadmap",
      count: detail.roadmapItems.length,
      content: (
        <div className="tcr">
          <style dangerouslySetInnerHTML={{ __html: ROADMAP_STYLES }} />

          {overview && (
            <section className="admin-card admin-section-card" style={{ marginBottom: 18 }}>
              <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
              <div style={{ fontSize: 14, lineHeight: 1.65 }}>
                <BotText text={overview} />
              </div>
            </section>
          )}

          <AddItemForm companyId={company.id} groups={addableGroups} programId={detail.id} />

          {detail.roadmapItems.length === 0 ? (
            <div className="admin-card admin-section-card" style={{ padding: 22 }}>
              <p className="admin-page-sub" style={{ margin: 0 }}>No roadmap items on this program yet.</p>
            </div>
          ) : (
            detail.roadmapGroups.map((g) => {
              const groupItems = detail.roadmapItems.filter((i) => i.group_key === g.key);
              if (groupItems.length === 0) return null;
              return (
                <div key={g.key} className="tcr-group">
                  <div className="tcr-group-head">
                    {g.step_label && <span className="tcr-step">{g.step_label}</span>}
                    <span className="tcr-group-title">{g.title}</span>
                  </div>
                  {g.intro && <div className="tcr-group-intro">{g.intro}</div>}
                  {groupItems.map((it) => (
                    <RoadmapItemCard key={it.id} item={it} companyId={company.id} />
                  ))}
                </div>
              );
            })
          )}
        </div>
      ),
    },
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
        eyebrow={<Link href={`/team/clients/${company.id}`}>← {company.name}</Link>}
        title={detail.name}
        sub={detail.githubRepo ?? undefined}
        action={
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>{/* layout-ok: mirrors the admin program badge row verbatim */}
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
