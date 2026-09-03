// Auth-agnostic board creation: unique slug, sort order, seeded columns. The
// admin Work Boards action and PR program setup both create boards through
// here; each caller gates authorization itself and records its own audit row.

import { companyOs } from "@/lib/supabase";
import { DEFAULT_COLUMNS } from "@/lib/boards/types";

export type CreateBoardResult =
  | { ok: true; id: string; slug: string; row: Record<string, unknown> }
  | { ok: false; error: string };

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "board"
  );
}

export async function createBoardRow(input: {
  name: string;
  clientCompanyId: string | null;
  prProgramId?: string | null;
  columns?: Array<{ name: string; is_done: boolean }>;
}): Promise<CreateBoardResult> {
  const name = input.name?.trim();
  if (!name) return { ok: false, error: "Name the board." };

  const base = slugify(name);
  let slug = base;
  for (let n = 2; ; n++) {
    const { data } = await companyOs.from("boards").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${n}`;
  }

  const { data: last } = await companyOs
    .from("boards")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = ((last as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const row = {
    name,
    slug,
    client_company_id: input.clientCompanyId,
    pr_program_id: input.prProgramId ?? null,
    sort_order,
  };
  const { data: board, error } = await companyOs.from("boards").insert(row).select("id").single();
  if (error || !board) return { ok: false, error: error?.message ?? "Could not create the board." };

  const columns = input.columns ?? DEFAULT_COLUMNS;
  await companyOs
    .from("board_columns")
    .insert(columns.map((c, i) => ({ board_id: board.id, name: c.name, position: i, is_done: c.is_done })));

  return { ok: true, id: board.id, slug, row };
}
