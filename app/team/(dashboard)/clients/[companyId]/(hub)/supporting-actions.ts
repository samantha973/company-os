"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { getActorClientCompanies } from "@/lib/team/clients";
import type { Result } from "@/lib/admin/mutations";
import * as core from "@/lib/hub/supporting-actions";

// Team-side writes for awards, pipeline, case studies and touchpoints.
// Authorization: the company must be in the actor's active assignments.

function refresh(companyId: string) {
  revalidatePath(`/team/clients/${companyId}`, "layout");
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath("/portal/hub");
  revalidatePath("/portal/awards");
  revalidatePath("/portal/case-studies");
}

const NOT_FOUND = { ok: false as const, error: "Not found." };

async function ctx(companyId: string): Promise<{ actor: string } | null> {
  const actor = await requireTeamMember();
  const companies = await getActorClientCompanies(actor);
  return companies.some((c) => c.id === companyId) ? { actor: actor.displayName } : null;
}
async function run<T extends Result>(companyId: string, fn: (c: { actor: string }) => Promise<T>): Promise<T | typeof NOT_FOUND> {
  const c = await ctx(companyId);
  if (!c) return NOT_FOUND;
  const r = await fn(c);
  if (r.ok) refresh(companyId);
  return r;
}

export const teamCreateAward = (companyId: string, programId: string, input: core.AwardInput) => run(companyId, (c) => core.createAwardCore(companyId, programId, input, c));
export const teamUpdateAward = (companyId: string, id: string, patch: core.AwardPatch) => run(companyId, (c) => core.updateAwardCore(companyId, id, patch, c));
export const teamPublishAward = (companyId: string, id: string, published: boolean) => run(companyId, (c) => core.publishAwardCore(companyId, id, published, c));
export const teamArchiveAward = (companyId: string, id: string) => run(companyId, (c) => core.archiveAwardCore(companyId, id, c));
export const teamCreatePipeline = (companyId: string, programId: string, input: core.PipelineInput) => run(companyId, (c) => core.createPipelineCore(companyId, programId, input, c));
export const teamUpdatePipeline = (companyId: string, id: string, patch: core.PipelinePatch) => run(companyId, (c) => core.updatePipelineCore(companyId, id, patch, c));
export const teamPublishPipeline = (companyId: string, id: string, published: boolean) => run(companyId, (c) => core.publishPipelineCore(companyId, id, published, c));
export const teamArchivePipeline = (companyId: string, id: string) => run(companyId, (c) => core.archivePipelineCore(companyId, id, c));
export const teamPromotePipeline = (companyId: string, id: string, input: { planId: string; groupKey: string; quantityTarget?: number | null }) => run(companyId, (c) => core.promotePipelineCore(companyId, id, input, c));
export const teamCreateCaseStudy = (companyId: string, programId: string, input: core.CaseStudyInput) => run(companyId, (c) => core.createCaseStudyCore(companyId, programId, input, c));
export const teamUpdateCaseStudy = (companyId: string, id: string, patch: core.CaseStudyPatch) => run(companyId, (c) => core.updateCaseStudyCore(companyId, id, patch, c));
export const teamPublishCaseStudy = (companyId: string, id: string, published: boolean) => run(companyId, (c) => core.publishCaseStudyCore(companyId, id, published, c));
export const teamArchiveCaseStudy = (companyId: string, id: string) => run(companyId, (c) => core.archiveCaseStudyCore(companyId, id, c));
export const teamLogTouchpoint = (companyId: string, programId: string, input: core.TouchpointInput) => run(companyId, (c) => core.logTouchpointCore(companyId, programId, input, c));
