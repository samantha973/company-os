"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import type { Result } from "@/lib/admin/mutations";
import {
  setupProgramWorkspaceCore,
  updateProgramEngagementCore,
  type ProgramEngagementPatch,
} from "@/lib/hub/program-actions";

function refresh(companyId: string, programId: string) {
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath(`/admin/revenue/companies/${companyId}/programs/${programId}`);
  revalidatePath(`/team/clients/${companyId}`);
  revalidatePath("/portal/hub");
}

export async function updateProgramEngagement(
  companyId: string,
  programId: string,
  patch: ProgramEngagementPatch,
): Promise<Result> {
  const admin = await requireAdmin();
  const r = await updateProgramEngagementCore(companyId, programId, patch, { actor: admin.email, role: "admin" });
  if (r.ok) refresh(companyId, programId);
  return r;
}

export async function setupProgramWorkspace(
  companyId: string,
  programId: string,
): Promise<Result & { boardSlug?: string }> {
  const admin = await requireAdmin();
  const r = await setupProgramWorkspaceCore(companyId, programId, admin.email);
  if (r.ok) {
    refresh(companyId, programId);
    revalidatePath("/admin/boards", "layout");
    revalidatePath("/team/boards", "layout");
  }
  return r;
}
