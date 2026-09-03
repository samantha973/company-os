"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { getActorClientCompanies } from "@/lib/team/clients";
import type { Result } from "@/lib/admin/mutations";
import {
  setupProgramWorkspaceCore,
  updateProgramEngagementCore,
  type ProgramEngagementPatch,
} from "@/lib/hub/program-actions";

// Team-side engagement edits. Authorization: the company must be in the
// actor's active assignments (out of scope reads as not-found, never as a
// permission error). The fee stays admin-only in the core.

function refresh(companyId: string, programId: string) {
  revalidatePath(`/team/clients/${companyId}`);
  revalidatePath(`/team/clients/${companyId}/programs/${programId}`);
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath("/portal/hub");
}

async function inScope(companyId: string): Promise<{ actor: string } | null> {
  const actor = await requireTeamMember();
  const companies = await getActorClientCompanies(actor);
  return companies.some((c) => c.id === companyId) ? { actor: actor.displayName } : null;
}

export async function teamUpdateProgramEngagement(
  companyId: string,
  programId: string,
  patch: ProgramEngagementPatch,
): Promise<Result> {
  const scope = await inScope(companyId);
  if (!scope) return { ok: false, error: "Not found." };
  const r = await updateProgramEngagementCore(companyId, programId, patch, { actor: scope.actor, role: "team" });
  if (r.ok) refresh(companyId, programId);
  return r;
}

export async function teamSetupProgramWorkspace(
  companyId: string,
  programId: string,
): Promise<Result & { boardSlug?: string }> {
  const scope = await inScope(companyId);
  if (!scope) return { ok: false, error: "Not found." };
  const r = await setupProgramWorkspaceCore(companyId, programId, scope.actor);
  if (r.ok) {
    refresh(companyId, programId);
    revalidatePath("/team/boards", "layout");
    revalidatePath("/admin/boards", "layout");
  }
  return r;
}
