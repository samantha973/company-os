// Shared, company-scoped loaders for the PR Program view (Client Hub by AI
// Program, PR 1). A PR Program = one company_os.pr_programs row, plus roadmap
// items, boards, and documents tagged via their nullable pr_program_id columns.
//
// Same discipline as lib/admin/company-hub.ts: these take a companyId directly
// and never widen scope; authorization is the caller's gate (requireAdmin via
// the admin layout today, team/portal actors later). Reads go through the
// service-role companyOs client.
//
// Every loader degrades: a company with no programs returns an empty list.

import { companyOs } from "@/lib/supabase";
import {
  BACKLOG_SELECT,
  ROADMAP_GROUPS_SELECT,
  type BacklogItem,
  type RoadmapGroup,
} from "@/lib/client-backlog";
import { listDocumentsForCompanies, type ClientDocument } from "@/lib/client-documents";
import { getMeetingsForCompany, type AdminMeetingRow } from "@/lib/admin/meetings";

export type ProgramStatus = "draft" | "active" | "complete";

export type ProgramSummary = {
  id: string;
  name: string;
  status: ProgramStatus;
  githubRepo: string | null;
  repoUrl: string | null;
  // Company OS rollups (by pr_program_id).
  roadmapDone: number; // backlog items with status 'shipped'
  roadmapTotal: number;
  boardCount: number; // active boards keyed to this program
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

type ProgramRow = {
  id: string;
  name: string;
  status: ProgramStatus;
  github_repo: string | null;
  repo_url: string | null;
};

// The select behind ProgramRow, exported so a surface that already needs the
// full pr_programs rows (the hub home) can fetch them once and hand them in.
export const PROGRAM_SELECT = "id, name, status, github_repo, repo_url";

// Everything listProgramSummaries aggregates over, so a caller that already
// fetched these datasets for its own rendering (the hub home fetches the full
// backlog and board rows anyway) can pass them in and no dataset is fetched
// twice per page load. Shapes are structural minimums; richer rows (e.g. full
// BacklogItem) satisfy them.
export type ProgramSummaryInputs = {
  programs: ProgramRow[];
  backlogRows: Array<{ pr_program_id: string | null; status: string }>; // active items
  boardRows: Array<{ pr_program_id: string | null }>; // active boards
};

export async function fetchProgramSummaryInputs(companyId: string): Promise<ProgramSummaryInputs> {
  const [{ data: programData }, backlogRows, boardRows] = await Promise.all([
    companyOs
      .from("pr_programs")
      .select(PROGRAM_SELECT)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    fetchAll<{ pr_program_id: string | null; status: string }>(() =>
      companyOs
        .from("client_backlog_items")
        .select("pr_program_id, status")
        .eq("company_id", companyId)
        .is("archived_at", null)
        .order("id"),
    ),
    fetchAll<{ pr_program_id: string | null }>(() =>
      companyOs
        .from("boards")
        .select("pr_program_id")
        .eq("client_company_id", companyId)
        .eq("status", "active")
        .is("archived_at", null)
        .order("id"),
    ),
  ]);
  return { programs: (programData ?? []) as ProgramRow[], backlogRows, boardRows };
}

export async function listProgramSummaries(
  companyId: string,
  pre?: ProgramSummaryInputs,
): Promise<ProgramSummary[]> {
  const inputs = pre ?? (await fetchProgramSummaryInputs(companyId));
  const { programs, backlogRows, boardRows } = inputs;
  if (programs.length === 0) return [];

  const doneByProgram = new Map<string, number>();
  const totalByProgram = new Map<string, number>();
  for (const r of backlogRows) {
    if (!r.pr_program_id) continue;
    totalByProgram.set(r.pr_program_id, (totalByProgram.get(r.pr_program_id) ?? 0) + 1);
    if (r.status === "shipped") {
      doneByProgram.set(r.pr_program_id, (doneByProgram.get(r.pr_program_id) ?? 0) + 1);
    }
  }

  const boardsByProgram = new Map<string, number>();
  for (const r of boardRows) {
    if (!r.pr_program_id) continue;
    boardsByProgram.set(r.pr_program_id, (boardsByProgram.get(r.pr_program_id) ?? 0) + 1);
  }

  return programs.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    githubRepo: p.github_repo,
    repoUrl: p.repo_url,
    roadmapDone: doneByProgram.get(p.id) ?? 0,
    roadmapTotal: totalByProgram.get(p.id) ?? 0,
    boardCount: boardsByProgram.get(p.id) ?? 0,
  }));
}

export async function getProgramDetail(
  companyId: string,
  programId: string,
): Promise<ProgramDetail | null> {
  const summaries = await listProgramSummaries(companyId);
  const summary = summaries.find((s) => s.id === programId);
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
