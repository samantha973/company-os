// Portal-facing PR Program hub loaders (Client Hub by PR Program, portal PR).
// Same discipline as the other lib/portal helpers: every read is scoped to the
// actor's own companyScope and cross-company ids resolve to null (IDOR guard).
//
// CLIENT-SAFE HARD LINE: these loaders return program name, status, the
// published tallies and the PUBLISHED plan snapshot only. Health, fee, leads,
// drive folders and internal notes never leave this module; the shapes below
// simply do not carry them.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { listProgramSummaries, type ProgramStats, type ProgramStatus } from "@/lib/hub/program";
import { getCurrentPlanSnapshots, type PlanSnapshot } from "@/lib/hub/plan";
import type { ClientBoardColumn, ClientBoardCard } from "@/lib/boards/client-view";
import { prMeta } from "@/lib/boards/types";

export type PortalProgramSummary = {
  id: string;
  companyId: string;
  name: string;
  status: ProgramStatus;
  // One line derived from the program plan's 5Ds brief; null when no plan
  // brief exists yet.
  description: string | null;
  // The agency people on the account, by display name. Client-safe.
  accountLead: string | null;
  strategicLead: string | null;
  stats: Pick<ProgramStats, "coverageCount" | "linkedinPostCount">;
  // The current PUBLISHED 90-day plan, or null while the team is drafting.
  currentPlan: Pick<PlanSnapshot, "id" | "quarterLabel" | "startsOn" | "endsOn" | "targetsTotal" | "targetsOnTrack" | "targetsWithVariance"> | null;
};

// Strip a brief's HTML down to one readable line. Headings and short label
// lines ("Dream", "PR Program Brief") are skipped; the first substantial text
// run wins, capped at a word boundary.
const MAX_DESCRIPTION = 160;
export function briefToOneLine(html: string): string | null {
  const text = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(h1|h2|h3|h4)[\s\S]*?<\/\1>/gi, "\n")
    .replace(/<(p|div|li|br|tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (line.length < 30) continue; // heading or label, not a description
    if (line.length <= MAX_DESCRIPTION) return line;
    const cut = line.slice(0, MAX_DESCRIPTION);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 100))}…`;
  }
  return null;
}

export async function listPortalProgramSummaries(actor: PortalActor): Promise<PortalProgramSummary[]> {
  if (actor.companyScope.length === 0) return [];
  const perCompany = await Promise.all(
    actor.companyScope.map(async (companyId) => {
      const [summaries, publishedPlans] = await Promise.all([
        listProgramSummaries(companyId),
        getCurrentPlanSnapshots(companyId, { publishedOnly: true }),
      ]);
      return { companyId, summaries, publishedPlans };
    }),
  );
  const rows = perCompany.flatMap(({ companyId, summaries, publishedPlans }) =>
    summaries.map((s) => ({ companyId, s, plan: publishedPlans.get(s.id) ?? null })),
  );
  if (rows.length === 0) return [];

  // First chat-plan brief per program feeds the one-line description.
  const { data: planData } = await companyOs
    .from("program_plans")
    .select("pr_program_id, brief_html")
    .in("pr_program_id", rows.map((r) => r.s.id))
    .eq("method", "chat")
    .not("brief_html", "is", null)
    .order("created_at", { ascending: true });
  const briefByProgram = new Map<string, string>();
  for (const p of (planData ?? []) as Array<{ pr_program_id: string; brief_html: string }>) {
    if (!briefByProgram.has(p.pr_program_id)) briefByProgram.set(p.pr_program_id, p.brief_html);
  }

  return rows.map(({ companyId, s, plan }) => ({
    id: s.id,
    companyId,
    name: s.name,
    status: s.status,
    description: briefByProgram.has(s.id) ? briefToOneLine(briefByProgram.get(s.id) as string) : null,
    accountLead: s.accountLead?.name ?? null,
    strategicLead: s.strategicLead?.name ?? null,
    stats: { coverageCount: s.stats.coverageCount, linkedinPostCount: s.stats.linkedinPostCount },
    currentPlan: plan
      ? {
          id: plan.id,
          quarterLabel: plan.quarterLabel,
          startsOn: plan.startsOn,
          endsOn: plan.endsOn,
          targetsTotal: plan.targetsTotal,
          targetsOnTrack: plan.targetsOnTrack,
          targetsWithVariance: plan.targetsWithVariance,
        }
      : null,
  }));
}

// ── Boards ───────────────────────────────────────────────────────────────

export type PortalHubBoard = {
  id: string;
  name: string;
  slug: string;
  prProgramId: string | null;
};

// Every active board for the actor's companies, with its program tag, so the
// hub can pick the first UNTAGGED one and the program page its own boards.
export async function listHubBoardsForActor(actor: PortalActor): Promise<PortalHubBoard[]> {
  if (actor.companyScope.length === 0) return [];
  const { data } = await companyOs
    .from("boards")
    .select("id, name, slug, pr_program_id")
    .in("client_company_id", actor.companyScope)
    .eq("status", "active")
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return ((data ?? []) as Array<{ id: string; name: string; slug: string; pr_program_id: string | null }>).map(
    (b) => ({ id: b.id, name: b.name, slug: b.slug, prProgramId: b.pr_program_id }),
  );
}

export type PortalBoardView = {
  boardName: string;
  columns: ClientBoardColumn[];
  cards: ClientBoardCard[];
};

// One specific board's client-visible slice, by id. Mirrors the queries and
// PRIVACY HARD LINE of lib/boards/client-view.ts getClientBoardView (only
// non-internal, non-archived, top-level cards; explicit safe columns), which
// only supports "first board of the company" and so cannot serve a chosen
// board. Keep the two in lockstep; folding this into client-view.ts is a
// follow-up once the parallel team-mirror branch lands.
export async function getBoardViewForActor(actor: PortalActor, boardId: string): Promise<PortalBoardView | null> {
  if (actor.companyScope.length === 0) return null;
  const { data: boardRow } = await companyOs
    .from("boards")
    .select("id, name")
    .eq("id", boardId)
    .in("client_company_id", actor.companyScope)
    .eq("status", "active")
    .is("archived_at", null)
    .maybeSingle();
  if (!boardRow) return null;
  const board = boardRow as { id: string; name: string };

  const [colsRes, tasksRes] = await Promise.all([
    companyOs.from("board_columns").select("id, name, is_done").eq("board_id", board.id).order("position"),
    companyOs
      .from("tasks")
      .select("id, title, priority, due_date, status, board_column_id, assignee_id, sprint_id, created_at, metadata")
      .eq("board_id", board.id)
      .eq("internal", false)
      .is("parent_task_id", null)
      .is("archived_at", null)
      .order("position"),
  ]);

  const columns: ClientBoardColumn[] = ((colsRes.data ?? []) as { id: string; name: string; is_done: boolean }[]).map(
    (c) => ({ id: c.id, name: c.name, isDone: c.is_done }),
  );
  const tasks = (tasksRes.data ?? []) as {
    id: string;
    title: string;
    priority: ClientBoardCard["priority"];
    due_date: string | null;
    status: string;
    board_column_id: string | null;
    assignee_id: string | null;
    sprint_id: string | null;
    created_at: string;
    metadata: Record<string, unknown> | null;
  }[];

  const personIds = [...new Set(tasks.map((t) => t.assignee_id).filter(Boolean) as string[])];
  const sprintIds = [...new Set(tasks.map((t) => t.sprint_id).filter(Boolean) as string[])];
  const [peopleRes, sprintsRes] = await Promise.all([
    personIds.length
      ? companyOs.from("people").select("id, display_name, full_name, email").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; full_name: string | null; email: string }[] }),
    sprintIds.length
      ? companyOs.from("sprints").select("id, name").in("id", sprintIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const nameById = new Map(
    (peopleRes.data ?? []).map((p) => [p.id, p.display_name || p.full_name || p.email]),
  );
  const sprintById = new Map((sprintsRes.data ?? []).map((s) => [s.id, s.name]));

  const cards: ClientBoardCard[] = tasks.map((t) => {
    const pr = prMeta(t);
    return {
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.due_date,
      columnId: t.board_column_id,
      done: t.status === "done",
      assigneeId: t.assignee_id,
      assigneeName: t.assignee_id ? nameById.get(t.assignee_id) ?? null : null,
      sprintName: t.sprint_id ? sprintById.get(t.sprint_id) ?? null : null,
      createdAt: t.created_at,
      prType: pr.type,
      statusNote: pr.status_note,
      link: pr.link,
      internal: false,
    };
  });

  return { boardName: board.name, columns, cards };
}
