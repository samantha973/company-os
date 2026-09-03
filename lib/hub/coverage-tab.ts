// Everything the Coverage tab renders for a company's program: the outcome
// rows and the option lists the inline editors need. Company-scoped; the
// caller gates.

import { companyOs } from "@/lib/supabase";
import { listDocumentsForCompanies } from "@/lib/client-documents";
import { listProgramSummaries, type ProgramSummary } from "@/lib/hub/program";
import { listMediaContacts, listOutcomes, listProgramTaskOptions, type MediaContactOption, type Option, type OutcomeRow } from "@/lib/hub/outcomes";
import { ROADMAP_GROUPS_SELECT, type RoadmapGroup } from "@/lib/client-backlog";

export type CoverageTab = {
  program: ProgramSummary;
  rows: OutcomeRow[];
  targets: Array<{ id: string; title: string; groupTitle: string }>;
  tasks: Option[];
  journalists: MediaContactOption[];
  documents: Array<{ id: string; filename: string }>;
};

export async function getCoverageTab(companyId: string): Promise<CoverageTab | null> {
  const programs = await listProgramSummaries(companyId);
  const program = programs[0];
  if (!program) return null;

  const [rows, { data: targetRows }, { data: groupRows }, tasks, journalists, documents] = await Promise.all([
    listOutcomes(companyId, program.id),
    companyOs
      .from("client_backlog_items")
      .select("id, title, group_key, quarterly_plan_id")
      .eq("company_id", companyId)
      .eq("pr_program_id", program.id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    companyOs.from("client_roadmap_groups").select(ROADMAP_GROUPS_SELECT).eq("company_id", companyId).is("archived_at", null),
    listProgramTaskOptions(companyId, program.id),
    listMediaContacts(),
    listDocumentsForCompanies([companyId]),
  ]);
  const groups = (groupRows ?? []) as unknown as RoadmapGroup[];
  const groupTitle = (key: string) => groups.find((g) => g.key === key)?.title ?? key;
  const targets = ((targetRows ?? []) as Array<{ id: string; title: string; group_key: string }>).map((t) => ({
    id: t.id,
    title: t.title,
    groupTitle: groupTitle(t.group_key),
  }));

  return {
    program,
    rows,
    targets,
    tasks,
    journalists,
    documents: documents.filter((d) => d.source === "upload").map((d) => ({ id: d.id, filename: d.filename })),
  };
}
