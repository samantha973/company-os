"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { getActorClientCompanies } from "@/lib/team/clients";
import type { Result } from "@/lib/admin/mutations";
import {
  archiveTargetCore,
  createPlanCore,
  createTargetCore,
  createWorkstreamCore,
  publishPlanCore,
  updatePlanCore,
  updateTargetCore,
  type PlanInput,
  type PlanPatch,
  type TargetInput,
  type TargetPatch,
} from "@/lib/hub/plan-actions";

// Team-side plan writes. Authorization: the company must be in the actor's
// active assignments; out of scope reads as not-found.

function refresh(companyId: string) {
  revalidatePath(`/team/clients/${companyId}`);
  revalidatePath(`/team/clients/${companyId}/plan`);
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath("/portal/hub");
  revalidatePath("/portal/plan");
}

async function inScope(companyId: string): Promise<string | null> {
  const actor = await requireTeamMember();
  const companies = await getActorClientCompanies(actor);
  return companies.some((c) => c.id === companyId) ? actor.displayName : null;
}

const NOT_FOUND = { ok: false as const, error: "Not found." };

export async function teamCreatePlan(companyId: string, programId: string, input: PlanInput): Promise<Result & { id?: string }> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await createPlanCore(companyId, programId, input, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamUpdatePlan(companyId: string, planId: string, patch: PlanPatch): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await updatePlanCore(companyId, planId, patch, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamPublishPlan(companyId: string, planId: string, published: boolean): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await publishPlanCore(companyId, planId, published, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamCreateTarget(companyId: string, planId: string, input: TargetInput): Promise<Result & { id?: string }> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await createTargetCore(companyId, planId, input, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamUpdateTarget(companyId: string, targetId: string, patch: TargetPatch): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await updateTargetCore(companyId, targetId, patch, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamArchiveTarget(companyId: string, targetId: string): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await archiveTargetCore(companyId, targetId, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamCreateWorkstream(companyId: string, programId: string, title: string): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await createWorkstreamCore(companyId, programId, title, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
