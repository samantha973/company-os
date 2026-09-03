// Client-facing coverage and LinkedIn posts. Company-scoped through
// portalRead and PUBLISHED rows only. CLIENT-SAFE HARD LINE: the journalist
// and the board-card link never leave this module — the shape below does not
// carry them.

import type { PortalActor } from "@/lib/portal-auth";
import { portalRead } from "@/lib/portal/data";
import { COVERAGE_CHANNELS } from "@/lib/pr/enums";
import { outcomeKind, type OutcomeKind } from "@/lib/hub/outcomes";

export type PortalOutcome = {
  id: string;
  programId: string | null;
  kind: OutcomeKind;
  channel: string;
  title: string;
  outlet: string | null;
  url: string | null;
  publishDate: string | null;
  reach: number | null;
  copyMd: string | null;
  targetTitle: string | null;
};

const SELECT =
  "id, pr_program_id, channel, title, outlet, posted_url, publish_date, reach, copy_md, target:client_backlog_items!marketing_content_backlog_item_id_fkey(title)";

type Row = {
  id: string;
  pr_program_id: string | null;
  channel: string;
  title: string;
  outlet: string | null;
  posted_url: string | null;
  publish_date: string | null;
  reach: number | null;
  copy_md: string | null;
  target: { title: string } | { title: string }[] | null;
};

export async function hasPublishedOutcomes(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await portalRead(actor, "marketing_content", "id").not("published_at", "is", null).neq("status", "skipped").limit(1);
  return (data ?? []).length > 0;
}

export async function listOutcomesForActor(actor: PortalActor): Promise<PortalOutcome[]> {
  if (actor.companyScope.length === 0) return [];
  const { data } = await portalRead(actor, "marketing_content", SELECT)
    .in("channel", [...COVERAGE_CHANNELS, "linkedin"])
    .not("published_at", "is", null)
    .neq("status", "skipped")
    .order("publish_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    programId: r.pr_program_id,
    kind: outcomeKind(r.channel),
    channel: r.channel,
    title: r.title,
    outlet: r.outlet,
    url: r.posted_url,
    publishDate: r.publish_date,
    reach: r.reach,
    copyMd: r.copy_md,
    targetTitle: (Array.isArray(r.target) ? r.target[0] : r.target)?.title ?? null,
  }));
}
