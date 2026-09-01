-- PR Hub Phase 1: rename the AI Program engagement object to PR Program.
--
-- This instance is PR-only (see docs/plans/2026-09-01-pr-hub-client-sync.md,
-- Assumption 1): no AI-program client will ever live in this DB, so the rename
-- is literal, with no `kind` column and no dual-mode flexibility.
--
-- Postgres updates foreign keys, indexes and RLS policy *bodies* automatically
-- when a table or column is renamed. Object *names* do not change on their own,
-- so this script also renames every index and constraint that carries the
-- `ai_program` token. That keeps a fresh `pg_dump` of the live database free of
-- the old token, so `supabase/01-schema.sql` stays true and
-- `grep -r ai_program` returns zero.
--
-- Idempotent: re-running is a no-op. Every rename is guarded so a second run
-- neither errors nor double-applies.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/01-rename.sql

begin;

do $$
begin
  -- ─── The engagement table: ai_programs -> pr_programs ───────────────────
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'company_os' and c.relname = 'ai_programs') then
    alter table company_os.ai_programs rename to pr_programs;
  end if;

  -- ─── ai_program_id -> pr_program_id on every table that carries it ──────
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='boards' and column_name='ai_program_id') then
    alter table company_os.boards rename column ai_program_id to pr_program_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='client_backlog_items' and column_name='ai_program_id') then
    alter table company_os.client_backlog_items rename column ai_program_id to pr_program_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='client_roadmap_groups' and column_name='ai_program_id') then
    alter table company_os.client_roadmap_groups rename column ai_program_id to pr_program_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='client_roadmap_overview' and column_name='ai_program_id') then
    alter table company_os.client_roadmap_overview rename column ai_program_id to pr_program_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='meetings' and column_name='ai_program_id') then
    alter table company_os.meetings rename column ai_program_id to pr_program_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='program_documents' and column_name='ai_program_id') then
    alter table company_os.program_documents rename column ai_program_id to pr_program_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='program_plans' and column_name='ai_program_id') then
    alter table company_os.program_plans rename column ai_program_id to pr_program_id;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema='htt' and table_name='repos' and column_name='ai_program_id') then
    alter table htt.repos rename column ai_program_id to pr_program_id;
  end if;

  -- ─── companies.is_ai_program -> is_pr_program ──────────────────────────
  if exists (select 1 from information_schema.columns
             where table_schema='company_os' and table_name='companies' and column_name='is_ai_program') then
    alter table company_os.companies rename column is_ai_program to is_pr_program;
  end if;
end $$;

-- ─── Rename indexes so the dump carries no ai_program token ───────────────
alter index if exists company_os.ai_programs_company_idx                     rename to pr_programs_company_idx;
alter index if exists company_os.ai_programs_github_repo_key                  rename to pr_programs_github_repo_key;
alter index if exists company_os.ai_programs_status_idx                       rename to pr_programs_status_idx;
alter index if exists company_os.boards_ai_program_id_idx                     rename to boards_pr_program_id_idx;
alter index if exists company_os.client_backlog_items_ai_program_id_idx       rename to client_backlog_items_pr_program_id_idx;
alter index if exists company_os.client_roadmap_groups_ai_program_id_idx      rename to client_roadmap_groups_pr_program_id_idx;
alter index if exists company_os.client_roadmap_overview_ai_program_id_idx    rename to client_roadmap_overview_pr_program_id_idx;
alter index if exists company_os.meetings_ai_program_id_idx                   rename to meetings_pr_program_id_idx;

-- ─── Rename constraints (names are literal; bodies auto-updated) ──────────
do $$
begin
  if exists (select 1 from pg_constraint where conname='ai_programs_pkey') then
    alter table company_os.pr_programs rename constraint ai_programs_pkey to pr_programs_pkey;
  end if;
  if exists (select 1 from pg_constraint where conname='ai_programs_status_check') then
    alter table company_os.pr_programs rename constraint ai_programs_status_check to pr_programs_status_check;
  end if;
  if exists (select 1 from pg_constraint where conname='ai_programs_company_id_fkey') then
    alter table company_os.pr_programs rename constraint ai_programs_company_id_fkey to pr_programs_company_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='boards_ai_program_id_fkey') then
    alter table company_os.boards rename constraint boards_ai_program_id_fkey to boards_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='client_backlog_items_ai_program_id_fkey') then
    alter table company_os.client_backlog_items rename constraint client_backlog_items_ai_program_id_fkey to client_backlog_items_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='client_roadmap_groups_ai_program_id_fkey') then
    alter table company_os.client_roadmap_groups rename constraint client_roadmap_groups_ai_program_id_fkey to client_roadmap_groups_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='client_roadmap_overview_ai_program_id_fkey') then
    alter table company_os.client_roadmap_overview rename constraint client_roadmap_overview_ai_program_id_fkey to client_roadmap_overview_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='meetings_ai_program_id_fkey') then
    alter table company_os.meetings rename constraint meetings_ai_program_id_fkey to meetings_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='program_documents_ai_program_id_fkey') then
    alter table company_os.program_documents rename constraint program_documents_ai_program_id_fkey to program_documents_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='program_plans_ai_program_id_fkey') then
    alter table company_os.program_plans rename constraint program_plans_ai_program_id_fkey to program_plans_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='repos_ai_program_id_fkey') then
    alter table htt.repos rename constraint repos_ai_program_id_fkey to repos_pr_program_id_fkey;
  end if;
  if exists (select 1 from pg_constraint where conname='repos_ai_program_id_key') then
    alter table htt.repos rename constraint repos_ai_program_id_key to repos_pr_program_id_key;
  end if;
end $$;

-- ─── objectives.business_line: PR-only instance, retire the ai_programs value
update company_os.objectives set business_line='pr_programs' where business_line='ai_programs';
do $$
begin
  if exists (select 1 from pg_constraint where conname='objectives_business_line_check') then
    alter table company_os.objectives drop constraint objectives_business_line_check;
  end if;
end $$;
alter table company_os.objectives
  add constraint objectives_business_line_check
  check (business_line = any (array['staffing'::text, 'pr_programs'::text]));

-- ─── Refresh the comments so the schema tells the truth ───────────────────
comment on table company_os.pr_programs is 'Portal PR Programs: company-scoped client PR program records (draft/active/complete).';
comment on column company_os.meetings.pr_program_id is 'Optional PR Program tag; NULL = company-wide meeting.';

commit;
