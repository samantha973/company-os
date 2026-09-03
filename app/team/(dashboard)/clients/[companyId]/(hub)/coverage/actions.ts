"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { getActorClientCompanies } from "@/lib/team/clients";
import type { Result } from "@/lib/admin/mutations";
import {
  createOutcomeCore,
  publishOutcomeCore,
  removeOutcomeCore,
  updateOutcomeCore,
  type OutcomeInput,
  type OutcomePatch,
} from "@/lib/hub/outcome-actions";

function refresh(companyId: string) {
  revalidatePath(`/team/clients/${companyId}`);
  revalidatePath(`/team/clients/${companyId}/coverage`);
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath("/portal/hub");
  revalidatePath("/portal/coverage");
}

async function inScope(companyId: string): Promise<string | null> {
  const actor = await requireTeamMember();
  const companies = await getActorClientCompanies(actor);
  return companies.some((c) => c.id === companyId) ? actor.displayName : null;
}
const NOT_FOUND = { ok: false as const, error: "Not found." };

export async function teamCreateOutcome(companyId: string, programId: string, input: OutcomeInput): Promise<Result & { id?: string }> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await createOutcomeCore(companyId, programId, input, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamUpdateOutcome(companyId: string, outcomeId: string, patch: OutcomePatch): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await updateOutcomeCore(companyId, outcomeId, patch, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamPublishOutcome(companyId: string, outcomeId: string, published: boolean): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await publishOutcomeCore(companyId, outcomeId, published, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
export async function teamRemoveOutcome(companyId: string, outcomeId: string): Promise<Result> {
  const actor = await inScope(companyId);
  if (!actor) return NOT_FOUND;
  const r = await removeOutcomeCore(companyId, outcomeId, { actor });
  if (r.ok) refresh(companyId);
  return r;
}
