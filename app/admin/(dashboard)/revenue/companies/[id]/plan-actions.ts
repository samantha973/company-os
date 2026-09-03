"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
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

function refresh(companyId: string) {
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath(`/team/clients/${companyId}`);
  revalidatePath(`/team/clients/${companyId}/plan`);
  revalidatePath("/portal/hub");
  revalidatePath("/portal/plan");
}

export async function adminCreatePlan(companyId: string, programId: string, input: PlanInput): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const r = await createPlanCore(companyId, programId, input, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminUpdatePlan(companyId: string, planId: string, patch: PlanPatch): Promise<Result> {
  const admin = await requireAdmin();
  const r = await updatePlanCore(companyId, planId, patch, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminPublishPlan(companyId: string, planId: string, published: boolean): Promise<Result> {
  const admin = await requireAdmin();
  const r = await publishPlanCore(companyId, planId, published, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminCreateTarget(companyId: string, planId: string, input: TargetInput): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();
  const r = await createTargetCore(companyId, planId, input, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminUpdateTarget(companyId: string, targetId: string, patch: TargetPatch): Promise<Result> {
  const admin = await requireAdmin();
  const r = await updateTargetCore(companyId, targetId, patch, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminArchiveTarget(companyId: string, targetId: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await archiveTargetCore(companyId, targetId, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
export async function adminCreateWorkstream(companyId: string, programId: string, title: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await createWorkstreamCore(companyId, programId, title, { actor: admin.email });
  if (r.ok) refresh(companyId);
  return r;
}
