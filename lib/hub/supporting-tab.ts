// Everything the Awards / Pipeline / Case Studies tabs render for a
// company's program, plus the option lists their editors need. Company-
// scoped; the caller gates.

import { companyOs } from "@/lib/supabase";
import { listDocumentsForCompanies } from "@/lib/client-documents";
import { listProgramSummaries, type ProgramSummary } from "@/lib/hub/program";
import { listPlans, type QuarterlyPlan } from "@/lib/hub/plan";
import { listAwards, listCaseStudies, listCustomerPicks, listPipeline, listTouchpoints, type AwardRow, type CaseStudyRow, type PersonPick, type PipelineRow, type TouchpointRow } from "@/lib/hub/supporting";
import { ROADMAP_GROUPS_SELECT, type RoadmapGroup } from "@/lib/client-backlog";

export type SupportingTab = {
  program: ProgramSummary;
  awards: AwardRow[];
  pipeline: PipelineRow[];
  caseStudies: CaseStudyRow[];
  touchpoints: TouchpointRow[];
  plans: Array<{ id: string; label: string }>;
  planRows: QuarterlyPlan[]; // full rows, for the plan-scope filter
  groups: Array<{ key: string; title: string }>;
  documents: Array<{ id: string; filename: string }>;
  customers: PersonPick[];
};

export async function getSupportingTab(companyId: string): Promise<SupportingTab | null> {
  const programs = await listProgramSummaries(companyId);
  const program = programs[0];
  if (!program) return null;
  const [awards, pipeline, caseStudies, touchpoints, plans, { data: groupRows }, documents, customers] = await Promise.all([
    listAwards(companyId, program.id),
    listPipeline(companyId, program.id),
    listCaseStudies(companyId, program.id),
    listTouchpoints(companyId, program.id),
    listPlans(companyId, program.id),
    companyOs.from("client_roadmap_groups").select(ROADMAP_GROUPS_SELECT).eq("company_id", companyId).is("archived_at", null).order("sort_order", { ascending: true }),
    listDocumentsForCompanies([companyId]),
    listCustomerPicks(companyId),
  ]);
  const groups = ((groupRows ?? []) as unknown as RoadmapGroup[])
    .filter((g) => g.pr_program_id === null || g.pr_program_id === program.id)
    .map((g) => ({ key: g.key, title: g.title }));
  return {
    program,
    awards,
    pipeline,
    caseStudies,
    touchpoints,
    plans: plans.map((p) => ({ id: p.id, label: p.quarter_label })),
    planRows: plans,
    groups,
    documents: documents.filter((d) => d.source === "upload").map((d) => ({ id: d.id, filename: d.filename })),
    customers,
  };
}
