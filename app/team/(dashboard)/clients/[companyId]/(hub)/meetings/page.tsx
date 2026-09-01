import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientMeetingsForActor } from "@/lib/team/clients";
import { MeetingsPanel, type ProgramOption } from "@/components/hub/MeetingsPanel";
import { companyOs } from "@/lib/supabase";
import { publishMeeting, setMeetingProgram } from "./actions";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Meetings" };

// The Meetings tab: every meeting for this client. Team members are internal
// Edge8 staff, so they see drafts and published alike, can publish a meeting
// to the client (setMeetingPublished, actor-scoped), and can tag a meeting to
// one of the client's PR Programs. Clients only ever see the published ones
// on /portal. With PR Programs present, untagged meetings only; program
// meetings live in their PR Program view.
export default async function TeamClientMeetingsTab({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const meetings = await getClientMeetingsForActor(actor, params.companyId);
  if (meetings === null) notFound();

  const { data: programRows } = await companyOs
    .from("pr_programs")
    .select("id, name")
    .eq("company_id", params.companyId)
    .order("created_at", { ascending: false });
  const programOptions = (programRows ?? []) as ProgramOption[];
  const hasPrograms = programOptions.length > 0;
  const shown = hasPrograms ? meetings.filter((m) => !m.prProgramId) : meetings;

  return (
    <section className="admin-card admin-section-card">
      <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Meetings</h2>
      <MeetingsPanel meetings={shown} publishAction={publishMeeting} programAction={setMeetingProgram} programOptions={programOptions} />
    </section>
  );
}
