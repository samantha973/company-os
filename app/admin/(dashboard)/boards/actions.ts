"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { type Result } from "@/lib/admin/mutations";
import { createBoardRow } from "@/lib/boards/create-board";

// Create a board (admin only): unique slug, seeded with the default columns.
export async function createBoard(input: {
  name: string;
  clientCompanyId?: string;
}): Promise<Result & { slug?: string }> {
  const admin = await requireAdmin();
  const created = await createBoardRow({ name: input.name, clientCompanyId: input.clientCompanyId || null });
  if (!created.ok) return created;

  await recordAudit({ table: "boards", recordId: created.id, operation: "insert", actor: admin.email, newData: created.row });
  revalidatePath("/admin/boards", "layout");
  revalidatePath("/team/boards", "layout");
  return { ok: true, slug: created.slug };
}
