"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
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
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath(`/admin/clients/${companyId}`);
  revalidatePath(`/team/clients/${companyId}`);
  revalidatePath(`/team/clients/${companyId}/coverage`);
  revalidatePath("/portal/hub");
  revalidatePath("/portal/coverage");
}

export async function adminCreateOutcome(companyId: string, programId: string, input: OutcomeInput): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const r = await createOutcomeCore(companyId, programId, input, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminUpdateOutcome(companyId: string, outcomeId: string, patch: OutcomePatch): Promise<Result> {
  const admin = await requireAdmin();
  const r = await updateOutcomeCore(companyId, outcomeId, patch, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminPublishOutcome(companyId: string, outcomeId: string, published: boolean): Promise<Result> {
  const admin = await requireAdmin();
  const r = await publishOutcomeCore(companyId, outcomeId, published, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminRemoveOutcome(companyId: string, outcomeId: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await removeOutcomeCore(companyId, outcomeId, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
