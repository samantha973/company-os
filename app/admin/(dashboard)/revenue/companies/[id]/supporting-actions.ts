"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import type { Result } from "@/lib/admin/mutations";
import * as core from "@/lib/hub/supporting-actions";

function refresh(companyId: string) {
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath(`/admin/clients/${companyId}`);
  revalidatePath(`/team/clients/${companyId}`, "layout");
  revalidatePath("/portal/hub");
  revalidatePath("/portal/awards");
  revalidatePath("/portal/case-studies");
}

async function ctx() {
  const admin = await requireAdmin();
  return { actor: admin.email };
}
async function done<T extends Result>(companyId: string, r: T): Promise<T> {
  if (r.ok) refresh(companyId);
  return r;
}

export const adminCreateAward = async (companyId: string, programId: string, input: core.AwardInput) => done(companyId, await core.createAwardCore(companyId, programId, input, await ctx()));
export const adminUpdateAward = async (companyId: string, id: string, patch: core.AwardPatch) => done(companyId, await core.updateAwardCore(companyId, id, patch, await ctx()));
export const adminPublishAward = async (companyId: string, id: string, published: boolean) => done(companyId, await core.publishAwardCore(companyId, id, published, await ctx()));
export const adminArchiveAward = async (companyId: string, id: string) => done(companyId, await core.archiveAwardCore(companyId, id, await ctx()));
export const adminCreatePipeline = async (companyId: string, programId: string, input: core.PipelineInput) => done(companyId, await core.createPipelineCore(companyId, programId, input, await ctx()));
export const adminUpdatePipeline = async (companyId: string, id: string, patch: core.PipelinePatch) => done(companyId, await core.updatePipelineCore(companyId, id, patch, await ctx()));
export const adminPublishPipeline = async (companyId: string, id: string, published: boolean) => done(companyId, await core.publishPipelineCore(companyId, id, published, await ctx()));
export const adminArchivePipeline = async (companyId: string, id: string) => done(companyId, await core.archivePipelineCore(companyId, id, await ctx()));
export const adminPromotePipeline = async (companyId: string, id: string, input: { planId: string; groupKey: string; quantityTarget?: number | null }) => done(companyId, await core.promotePipelineCore(companyId, id, input, await ctx()));
export const adminCreateCaseStudy = async (companyId: string, programId: string, input: core.CaseStudyInput) => done(companyId, await core.createCaseStudyCore(companyId, programId, input, await ctx()));
export const adminUpdateCaseStudy = async (companyId: string, id: string, patch: core.CaseStudyPatch) => done(companyId, await core.updateCaseStudyCore(companyId, id, patch, await ctx()));
export const adminPublishCaseStudy = async (companyId: string, id: string, published: boolean) => done(companyId, await core.publishCaseStudyCore(companyId, id, published, await ctx()));
export const adminArchiveCaseStudy = async (companyId: string, id: string) => done(companyId, await core.archiveCaseStudyCore(companyId, id, await ctx()));
export const adminLogTouchpoint = async (companyId: string, programId: string, input: core.TouchpointInput) => done(companyId, await core.logTouchpointCore(companyId, programId, input, await ctx()));
