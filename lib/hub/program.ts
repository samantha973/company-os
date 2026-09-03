// Shared, company-scoped loaders for the PR Program (the engagement record
// on company_os.pr_programs) and everything that hangs off it: the derived
// tallies in pr_program_stats, the current 90-day plan snapshot, boards,
// documents and meetings tagged via their pr_program_id columns.
//
// Same discipline as lib/admin/company-hub.ts: these take a companyId directly
// and never widen scope; authorization is the caller's gate (requireAdmin via
// the admin layout, the team actor's assignments, the portal actor's scope).
// Reads go through the service-role companyOs client.
//
// INTERNAL FIELDS: ProgramSummary carries engagementFeeCents, health and
// internalDriveFolder. lib/portal/* must map to its own client-safe shape and
// never pass a ProgramSummary to a portal page.
//
// Every loader degrades: a company with no programs returns an empty list.

import { companyOs } from "@/lib/supabase";
import { BACKLOG_SELECT, ROADMAP_GROUPS_SELECT, type BacklogItem, type RoadmapGroup } from "@/lib/client-backlog";
import { listDocumentsForCompanies, type ClientDocument } from "@/lib/client-documents";
import { getMeetingsForCompany, type AdminMeetingRow } from "@/lib/admin/meetings";
import { personName, type NamedPerson } from "@/lib/people-name";
import { getCurrentPlanSnapshots, type PlanSnapshot } from "@/lib/hub/plan";
import type { ProgramHealth, ProgramStatus } from "@/lib/pr/enums";

export type { ProgramHealth, ProgramStatus } from "@/lib/pr/enums";

export type PersonRef = { id: string; name: string };

export type ProgramStats = {
  coverageCount: number;
  linkedinPostCount: number;
  lastFormalCatchup: string | null;
  awardsInFlight: number;
};

export type ProgramSummary = {
  id: string;
  companyId: string;
  name: string;
  status: ProgramStatus;
  createdAt: string;
  // Engagement record.
  health: ProgramHealth | null; // internal (admin + team), never the portal
  accountLead: PersonRef | null;
  strategicLead: PersonRef | null;
  contractStart: string | null;
  contractReview: string | null;
  engagementFeeCents: number | null; // admin only
  clientDriveFolder: string | null;
  internalDriveFolder: string | null; // internal
  // Derived.
  stats: ProgramStats;
  boardCount: number; // active boards keyed to this program
  unlinkedBoardCount: number; // the company's active boards not yet keyed to any program (pre-program-model data)
  currentPlan: PlanSnapshot | null;
};

export type ProgramBoard = {
  id: string;
  name: string;
  slug: string;
  cardCount: number; // live top-level cards
};

export type ProgramDetail = ProgramSummary & {
  roadmapGroups: RoadmapGroup[];
  roadmapItems: BacklogItem[];
  boards: ProgramBoard[];
  documents: ClientDocument[];
  meetings: AdminMeetingRow[]; // meetings tagged to this program (meetings.pr_program_id)
};

// PostgREST caps a response at 1000 rows; page through so a company with more
// backlog rows than that still aggregates correctly. Every factory MUST carry a
// total order ending on a unique column (id) so pages never repeat or skip
// rows. Exported so the other hub-grain consumers of the same capped tables
// (the admin hub home, lib/team/clients.ts) page identically instead of
// re-deriving the pattern.
const PAGE = 1000;
export async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: unknown }> },
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build().range(from, from + PAGE - 1);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

type PersonJoin = (NamedPerson & { id: string }) | (NamedPerson & { id: string })[] | null;

type ProgramRow = {
  id: string;
  company_id: string;
  name: string;
  status: ProgramStatus;
  created_at: string;
  account_health: ProgramHealth | null;
  contract_start: string | null;
  contract_review: string | null;
  engagement_fee_cents: number | null;
  client_drive_folder: string | null;
  internal_drive_folder: string | null;
  account_lead: PersonJoin;
  strategic_lead: PersonJoin;
};

const PERSON_JOIN = "id, display_name, preferred_name, full_name, email";
export const PROGRAM_SELECT =
  "id, company_id, name, status, created_at, account_health, contract_start, contract_review, engagement_fee_cents, client_drive_folder, internal_drive_folder, " +
  `account_lead:people!pr_programs_account_lead_id_fkey(${PERSON_JOIN}), strategic_lead:people!pr_programs_strategic_lead_id_fkey(${PERSON_JOIN})`;

const one = <T,>(e: T | T[] | null | undefined): T | null => (Array.isArray(e) ? e[0] ?? null : e ?? null);

function personRef(j: PersonJoin): PersonRef | null {
  const p = one(j);
  return p ? { id: p.id, name: personName(p) } : null;
}

type StatsRow = {
  pr_program_id: string;
  linkedin_post_count: number;
  coverage_count: number;
  last_formal_catchup: string | null;
  awards_in_flight: number;
};

const EMPTY_STATS: ProgramStats = { coverageCount: 0, linkedinPostCount: 0, lastFormalCatchup: null, awardsInFlight: 0 };

export async function listProgramSummaries(companyId: string): Promise<ProgramSummary[]> {
  const [{ data: programData }, { data: statsData }, boardRows, plans] = await Promise.all([
    companyOs
      .from("pr_programs")
      .select(PROGRAM_SELECT)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    companyOs.from("pr_program_stats").select("*").eq("company_id", companyId),
    fetchAll<{ pr_program_id: string | null }>(() =>
      companyOs
        .from("boards")
        .select("pr_program_id")
        .eq("client_company_id", companyId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("id"),
    ),
    getCurrentPlanSnapshots(companyId),
  ]);
  const programs = (programData ?? []) as unknown as ProgramRow[];
  if (programs.length === 0) return [];

  const statsById = new Map(((statsData ?? []) as StatsRow[]).map((s) => [s.pr_program_id, s]));
  const boardsByProgram = new Map<string, number>();
  let unlinkedBoards = 0;
  for (const r of boardRows) {
    if (!r.pr_program_id) {
      unlinkedBoards++;
      continue;
    }
    boardsByProgram.set(r.pr_program_id, (boardsByProgram.get(r.pr_program_id) ?? 0) + 1);
  }

  return programs.map((p) => {
    const s = statsById.get(p.id);
    return {
      id: p.id,
      companyId: p.company_id,
      name: p.name,
      status: p.status,
      createdAt: p.created_at,
      health: p.account_health,
      accountLead: personRef(p.account_lead),
      strategicLead: personRef(p.strategic_lead),
      contractStart: p.contract_start,
      contractReview: p.contract_review,
      engagementFeeCents: p.engagement_fee_cents,
      clientDriveFolder: p.client_drive_folder,
      internalDriveFolder: p.internal_drive_folder,
      stats: s
        ? {
            coverageCount: Number(s.coverage_count),
            linkedinPostCount: Number(s.linkedin_post_count),
            lastFormalCatchup: s.last_formal_catchup,
            awardsInFlight: Number(s.awards_in_flight),
          }
        : EMPTY_STATS,
      boardCount: boardsByProgram.get(p.id) ?? 0,
      unlinkedBoardCount: unlinkedBoards,
      currentPlan: plans.get(p.id) ?? null,
    };
  });
}

export async function getProgramSummary(companyId: string, programId: string): Promise<ProgramSummary | null> {
  const all = await listProgramSummaries(companyId);
  return all.find((p) => p.id === programId) ?? null;
}

export async function getProgramDetail(
  companyId: string,
  programId: string,
): Promise<ProgramDetail | null> {
  const summary = await getProgramSummary(companyId, programId);
  if (!summary) return null;

  const [{ data: groupData }, { data: itemData }, { data: boardData }, allDocuments, meetings] =
    await Promise.all([
      companyOs
        .from("client_roadmap_groups")
        .select(ROADMAP_GROUPS_SELECT)
        .eq("company_id", companyId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
      companyOs
        .from("client_backlog_items")
        .select(BACKLOG_SELECT)
        .eq("company_id", companyId)
        .eq("pr_program_id", programId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
      companyOs
        .from("boards")
        .select("id, name, slug")
        .eq("client_company_id", companyId)
        .eq("pr_program_id", programId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
      listDocumentsForCompanies([companyId]),
      getMeetingsForCompany(companyId, programId),
    ]);

  const roadmapItems = (itemData ?? []) as unknown as BacklogItem[];
  // The program's own sections, plus any company-wide section a program item
  // still sits under, so no item renders orphaned.
  const usedKeys = new Set(roadmapItems.map((i) => i.group_key));
  const roadmapGroups = ((groupData ?? []) as unknown as RoadmapGroup[]).filter(
    (g) => g.pr_program_id === programId || (g.pr_program_id === null && usedKeys.has(g.key)),
  );

  const boardRows = (boardData ?? []) as Array<{ id: string; name: string; slug: string }>;
  const cardsByBoard = new Map<string, number>();
  if (boardRows.length > 0) {
    const taskRows = await fetchAll<{ board_id: string }>(() =>
      companyOs
        .from("tasks")
        .select("board_id")
        .in("board_id", boardRows.map((b) => b.id))
        .is("archived_at", null)
        .is("parent_task_id", null)
        .order("id"),
    );
    for (const t of taskRows) {
      cardsByBoard.set(t.board_id, (cardsByBoard.get(t.board_id) ?? 0) + 1);
    }
  }

  return {
    ...summary,
    roadmapGroups,
    roadmapItems,
    boards: boardRows.map((b) => ({
      id: b.id,
      name: b.name,
      slug: b.slug,
      cardCount: cardsByBoard.get(b.id) ?? 0,
    })),
    documents: allDocuments.filter((d) => d.programId === programId),
    meetings,
  };
}
