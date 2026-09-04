"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import {
  createSignedDocumentUpload,
  recordDocument,
  recordLinkDocument,
  getDocumentRow,
  signedDownloadForPath,
  deleteDocumentRow,
  type DocResult,
} from "@/lib/client-documents";

// Admin-side client documents: upload for any company (optionally tagged to one
// of its PR Programs), download, and delete ANY document. Gated by
// requireAdmin() throughout; the client portal's uploader-only delete rule does
// not apply here — The PR Hub operates the whole surface.

function refresh(companyId: string) {
  revalidatePath(`/admin/revenue/companies/${companyId}`);
}

export async function adminSignedDocumentUpload(input: {
  companyId: string;
  filename: string;
  programId?: string | null;
}): Promise<DocResult<{ signedUrl: string; path: string }>> {
  await requireAdmin();
  // A tagged upload must tag a program that actually belongs to this company.
  if (input.programId) {
    const { data } = await companyOs
      .from("pr_programs")
      .select("id")
      .eq("id", input.programId)
      .eq("company_id", input.companyId)
      .maybeSingle();
    if (!data) return { ok: false, error: "That program does not belong to this company." };
  }
  return createSignedDocumentUpload(input);
}

export async function adminRecordDocument(input: {
  companyId: string;
  programId?: string | null;
  path: string;
  filename: string;
  sizeBytes: number | null;
}): Promise<DocResult> {
  const admin = await requireAdmin();
  const r = await recordDocument({ ...input, uploadedBy: admin.email });
  if (r.ok) refresh(input.companyId);
  return r;
}

// Record a Drive/URL link against a company, optionally tagged to one of its PR
// Programs (re-validated the same way as a tagged upload).
export async function adminRecordLink(input: {
  companyId: string;
  programId?: string | null;
  url: string;
  label: string;
}): Promise<DocResult> {
  const admin = await requireAdmin();
  if (input.programId) {
    const { data } = await companyOs
      .from("pr_programs")
      .select("id")
      .eq("id", input.programId)
      .eq("company_id", input.companyId)
      .maybeSingle();
    if (!data) return { ok: false, error: "That program does not belong to this company." };
  }
  const r = await recordLinkDocument({
    companyId: input.companyId,
    programId: input.programId ?? null,
    url: input.url,
    label: input.label,
    uploadedBy: admin.email,
  });
  if (r.ok) refresh(input.companyId);
  return r;
}

export async function adminDownloadDocument(
  documentId: string,
): Promise<DocResult<{ url: string; filename: string }>> {
  await requireAdmin();
  const row = await getDocumentRow(documentId);
  if (!row) return { ok: false, error: "Not found." };
  if (!row.storagePath) return { ok: false, error: "This is a link — open it directly." };
  const r = await signedDownloadForPath(row.storagePath, row.filename);
  if (!r.ok) return r;
  return { ok: true, url: r.url, filename: row.filename };
}

export async function adminDeleteDocument(documentId: string): Promise<DocResult> {
  await requireAdmin();
  const row = await getDocumentRow(documentId);
  if (!row) return { ok: false, error: "Not found." };
  const r = await deleteDocumentRow(row);
  if (r.ok) refresh(row.companyId);
  return r;
}
