-- PR Hub M2: the engagement record on pr_programs.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M2). One pr_programs
-- row per client retainer. Leads point at people; health, fee and the
-- internal drive folder are internal-only columns that lib/portal/* never
-- selects. Counts and last catch-up are views (09-views.sql), never columns.
-- repo_url / github_repo* stay in place (other code reads them) but are no
-- longer shown in the PR UI.
--
-- Idempotent: re-running is a no-op.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/03-pr-programs.sql

begin;

alter table company_os.pr_programs
  add column if not exists account_lead_id uuid references company_os.people(id) on delete set null,
  add column if not exists strategic_lead_id uuid references company_os.people(id) on delete set null,
  add column if not exists account_health text,
  add column if not exists contract_start date,
  add column if not exists contract_review date,
  add column if not exists engagement_fee_cents integer,
  add column if not exists client_drive_folder text,
  add column if not exists internal_drive_folder text;

alter table company_os.pr_programs drop constraint if exists pr_programs_account_health_check;
alter table company_os.pr_programs add constraint pr_programs_account_health_check
  check (account_health is null or account_health in ('green', 'amber', 'red'));

-- status gains 'paused'
alter table company_os.pr_programs drop constraint if exists pr_programs_status_check;
alter table company_os.pr_programs add constraint pr_programs_status_check
  check (status in ('draft', 'active', 'paused', 'complete'));

comment on table company_os.pr_programs is 'PR Programs: one row per client retainer/engagement, company-scoped. Every PR table keys to this via pr_program_id.';
comment on column company_os.pr_programs.status is 'Engagement state. Valid values: [draft, active, paused, complete]';
comment on column company_os.pr_programs.account_lead_id is 'people.id of the account lead (day-to-day owner).';
comment on column company_os.pr_programs.strategic_lead_id is 'people.id of the strategic lead.';
comment on column company_os.pr_programs.account_health is 'Internal-only RAG health; never shown to the client. Valid values: [green, amber, red]';
comment on column company_os.pr_programs.contract_start is 'Retainer start date.';
comment on column company_os.pr_programs.contract_review is 'Next contract review/renewal date.';
comment on column company_os.pr_programs.engagement_fee_cents is 'Internal-only monthly fee in cents; never shown to the client or team hub.';
comment on column company_os.pr_programs.client_drive_folder is 'Shared drive folder URL the client can open.';
comment on column company_os.pr_programs.internal_drive_folder is 'Internal-only drive folder URL.';

commit;
