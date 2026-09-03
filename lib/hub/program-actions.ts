// Auth-agnostic cores for the PR Program engagement record. Callers (admin
// and team server actions) gate authorization, then call these with the
// company id they have already verified. Every write is company-scoped in
// the query itself (never trust the program id alone), audited, and sets
// updated_at (no trigger on pr_programs).

import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import type { Result } from "@/lib/admin/mutations";
import { createBoardRow } from "@/lib/boards/create-board";
import { PR_COLUMNS } from "@/lib/boards/types";
import { isOneOf, PROGRAM_HEALTH, PROGRAM_STATUSES } from "@/lib/pr/enums";

export type ProgramEngagementPatch = Partial<{
  name: string;
  status: string;
  account_health: string | null;
  account_lead_id: string | null;
  strategic_lead_id: string | null;
  contract_start: string | null;
  contract_review: string | null;
  engagement_fee_cents: number | null;
  client_drive_folder: string | null;
  internal_drive_folder: string | null;
}>;

// Fields the team hub may edit. Fee stays admin-only.
const TEAM_KEYS = new Set<keyof ProgramEngagementPatch>([
  "account_health",
  "account_lead_id",
  "strategic_lead_id",
  "contract_start",
  "contract_review",
  "client_drive_folder",
  "internal_drive_folder",
]);

async function programBelongs(companyId: string, programId: string): Promise<boolean> {
  const { data } = await companyOs
    .from("pr_programs")
    .select("id")
    .eq("id", programId)
    .eq("company_id", companyId)
    .maybeSingle();
  return !!data;
}

function nul(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export async function updateProgramEngagementCore(
  companyId: string,
  programId: string,
  patch: ProgramEngagementPatch,
  opts: { actor: string; role: "admin" | "team" },
): Promise<Result> {
  if (!(await programBelongs(companyId, programId))) return { ok: false, error: "Program not found." };

  const row: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch) as Array<[keyof ProgramEngagementPatch, unknown]>) {
    if (opts.role === "team" && !TEAM_KEYS.has(k)) return { ok: false, error: `Only an admin can change ${k.replace(/_/g, " ")}.` };
    switch (k) {
      case "name": {
        const name = nul(v);
        if (!name) return { ok: false, error: "Name the program." };
        row.name = name;
        break;
      }
      case "status":
        if (!isOneOf(PROGRAM_STATUSES, v)) return { ok: false, error: "Invalid status." };
        row.status = v;
        break;
      case "account_health": {
        const h = nul(v);
        if (h !== null && !isOneOf(PROGRAM_HEALTH, h)) return { ok: false, error: "Invalid health." };
        row.account_health = h;
        break;
      }
      case "engagement_fee_cents": {
        if (v === null || v === "" || v === undefined) {
          row.engagement_fee_cents = null;
        } else {
          const n = Number(v);
          if (!Number.isFinite(n) || n < 0) return { ok: false, error: "Fee must be a number." };
          row.engagement_fee_cents = Math.round(n);
        }
        break;
      }
      default:
        row[k] = nul(v);
    }
  }
  if (Object.keys(row).length === 0) return { ok: true };
  row.updated_at = new Date().toISOString();

  const { error } = await companyOs.from("pr_programs").update(row).eq("id", programId).eq("company_id", companyId);
  if (error) return { ok: false, error: error.message };
  await recordAudit({ table: "pr_programs", recordId: programId, operation: "update", actor: opts.actor, newData: row });
  return { ok: true };
}

// Give a program its working parts: the standard PR workstreams (idempotent;
// the SQL function skips keys the company already has) and, when it has no
// active board yet, one Work Board with the PR column ladder.
export async function setupProgramWorkspaceCore(
  companyId: string,
  programId: string,
  actor: string,
): Promise<Result & { boardSlug?: string }> {
  const { data: program } = await companyOs
    .from("pr_programs")
    .select("id, name")
    .eq("id", programId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!program) return { ok: false, error: "Program not found." };

  const { error: seedErr } = await companyOs.rpc("seed_pr_workstreams", { p_program_id: programId });
  if (seedErr) return { ok: false, error: seedErr.message };

  const { data: existing } = await companyOs
    .from("boards")
    .select("slug")
    .eq("client_company_id", companyId)
    .eq("pr_program_id", programId)
    .eq("status", "active")
    .is("archived_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, boardSlug: (existing as { slug: string }).slug };

  // Boards created before the program model carry the company but no
  // program. Adopt them rather than creating a second board beside them.
  const { data: unlinked } = await companyOs
    .from("boards")
    .select("id, slug")
    .eq("client_company_id", companyId)
    .is("pr_program_id", null)
    .eq("status", "active")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  const orphans = (unlinked ?? []) as Array<{ id: string; slug: string }>;
  if (orphans.length > 0) {
    const ids = orphans.map((b) => b.id);
    const { error: linkErr } = await companyOs.from("boards").update({ pr_program_id: programId }).in("id", ids);
    if (linkErr) return { ok: false, error: linkErr.message };
    for (const b of orphans) {
      await recordAudit({ table: "boards", recordId: b.id, operation: "update", actor, newData: { pr_program_id: programId } });
    }
    return { ok: true, boardSlug: orphans[0].slug };
  }

  const created = await createBoardRow({
    name: `${(program as { name: string }).name} — Work Board`,
    clientCompanyId: companyId,
    prProgramId: programId,
    columns: PR_COLUMNS,
  });
  if (!created.ok) return created;
  await recordAudit({ table: "boards", recordId: created.id, operation: "insert", actor, newData: created.row });
  return { ok: true, boardSlug: created.slug };
}
