-- PR Hub Phase 2: additive, nullable extensions. Nothing here is destructive;
-- existing rows keep working and existing code paths are unaffected until the
-- Phase 3 UI starts writing the new columns.
--
-- Run AFTER 01-rename.sql (this references pr_program_id / pr_programs names).
-- Idempotent: guarded with IF NOT EXISTS / catalog checks.
--
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/02-extensions.sql

begin;

-- ─── program_documents: a row is now an upload OR a Drive/URL link ─────────
-- Only program_documents backs the client-hub document flow (lib/client-documents.ts);
-- the generic company_os.documents table is untouched.
alter table company_os.program_documents
  add column if not exists external_url text,
  add column if not exists source text not null default 'upload';

-- storage_path was NOT NULL (upload-only). Links have no object, so relax it and
-- enforce "exactly one of storage_path / external_url" instead.
alter table company_os.program_documents alter column storage_path drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='program_documents_source_check') then
    alter table company_os.program_documents
      add constraint program_documents_source_check
      check (source = any (array['upload'::text, 'link'::text]));
  end if;
  if not exists (select 1 from pg_constraint where conname='program_documents_path_or_url_check') then
    alter table company_os.program_documents
      add constraint program_documents_path_or_url_check
      check (
        (storage_path is not null and external_url is null)
        or (storage_path is null and external_url is not null)
      );
  end if;
end $$;

-- ─── program_plans: quarter + client sign-off date ────────────────────────
alter table company_os.program_plans
  add column if not exists quarter text,
  add column if not exists signed_off_at date;

-- ─── marketing_content: company scoping + earned-media fields ─────────────
alter table company_os.marketing_content
  add column if not exists company_id uuid,
  add column if not exists outlet text,
  add column if not exists reach integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='marketing_content_company_id_fkey') then
    alter table company_os.marketing_content
      add constraint marketing_content_company_id_fkey
      foreign key (company_id) references company_os.companies(id) on delete set null;
  end if;
end $$;

create index if not exists marketing_content_company_id_idx
  on company_os.marketing_content using btree (company_id) where (company_id is not null);

-- Widen the channel check to cover earned coverage, podcasts and speaking.
do $$
begin
  if exists (select 1 from pg_constraint where conname='marketing_content_channel_check') then
    alter table company_os.marketing_content drop constraint marketing_content_channel_check;
  end if;
end $$;
alter table company_os.marketing_content
  add constraint marketing_content_channel_check
  check (channel = any (array[
    'blog'::text, 'email'::text, 'linkedin'::text, 'facebook'::text,
    'earned'::text, 'podcast'::text, 'speaking'::text
  ]));

commit;
