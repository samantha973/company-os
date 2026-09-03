-- PR Hub M4: the plan layer — 90-day plans, targets, workstreams, LinkedIn strategy.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M4).
--   * pr_quarterly_plans is new: one row per program per quarter, keyed off
--     the planning meeting (meetings row carries transcript/recording/summary).
--   * Plan targets are client_backlog_items (existing); they gain the plan
--     link, a numeric target and the variance reason/note.
--   * Workstreams are client_roadmap_groups (existing). seed_pr_workstreams()
--     inserts the standard PR set for a program; keys match the rows the
--     first client already carries (hyphenated).
--   * LinkedIn strategy is a program_plans row with method='linkedin_strategy';
--     program_plans already has quarter and signed_off_at.
--
-- Idempotent: re-running is a no-op.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/05-plan-layer.sql

begin;

-- ─── pr_quarterly_plans ────────────────────────────────────────────────────
create table if not exists company_os.pr_quarterly_plans (
  id                  uuid primary key default gen_random_uuid(),
  pr_program_id       uuid not null references company_os.pr_programs(id) on delete cascade,
  company_id          uuid not null references company_os.companies(id) on delete cascade,
  quarter_label       text not null,
  starts_on           date not null,
  ends_on             date not null,
  planning_meeting_id uuid references company_os.meetings(id) on delete set null,
  business_objective  text,
  comms_objective     text,
  approved_plan_md    text,
  signoff_date        date,
  published_at        timestamptz,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  archived_by         text,
  constraint pr_quarterly_plans_dates_check check (ends_on >= starts_on),
  constraint pr_quarterly_plans_program_quarter_key unique (pr_program_id, quarter_label)
);

create index if not exists pr_quarterly_plans_program_idx on company_os.pr_quarterly_plans (pr_program_id);
create index if not exists pr_quarterly_plans_company_idx on company_os.pr_quarterly_plans (company_id);

alter table company_os.pr_quarterly_plans enable row level security;
-- Same access model as client_backlog_items: service-role only (RLS on, no
-- policies), read-only for the chatbot reader.
grant select, insert, update, delete on company_os.pr_quarterly_plans to service_role;
grant select on company_os.pr_quarterly_plans to chatbot_reader;
grant select, insert, update on company_os.pr_quarterly_plans to chatbot_writer;

comment on table company_os.pr_quarterly_plans is 'One row is a 90-day plan for one PR program: the agreed business and comms objectives for a quarter, keyed off the planning meeting. Targets are client_backlog_items with quarterly_plan_id set.';
comment on column company_os.pr_quarterly_plans.pr_program_id is 'The program this quarter belongs to.';
comment on column company_os.pr_quarterly_plans.company_id is 'Denormalised client company for scope checks; always equals pr_programs.company_id.';
comment on column company_os.pr_quarterly_plans.quarter_label is 'Display label, unique per program, e.g. Q2 FY27.';
comment on column company_os.pr_quarterly_plans.starts_on is 'First day of the quarter.';
comment on column company_os.pr_quarterly_plans.ends_on is 'Last day of the quarter.';
comment on column company_os.pr_quarterly_plans.planning_meeting_id is 'meetings.id of the quarterly planning session the plan was keyed off; the meeting row holds transcript, recording and summary.';
comment on column company_os.pr_quarterly_plans.business_objective is 'What the client business needs this quarter, in their words.';
comment on column company_os.pr_quarterly_plans.comms_objective is 'What comms will deliver this quarter to serve the business objective.';
comment on column company_os.pr_quarterly_plans.approved_plan_md is 'Optional longer approved plan, markdown.';
comment on column company_os.pr_quarterly_plans.signoff_date is 'Date the client signed the plan off.';
comment on column company_os.pr_quarterly_plans.published_at is 'When the plan was made visible in the client hub; null = internal draft.';
comment on column company_os.pr_quarterly_plans.created_by is 'Email of the creator.';
comment on column company_os.pr_quarterly_plans.archived_at is 'Soft delete; null = live.';
comment on column company_os.pr_quarterly_plans.archived_by is 'Who archived it.';

-- ─── client_backlog_items = plan targets ──────────────────────────────────
alter table company_os.client_backlog_items
  add column if not exists quarterly_plan_id uuid references company_os.pr_quarterly_plans(id) on delete set null,
  add column if not exists quantity_target integer,
  add column if not exists variance_reason text,
  add column if not exists variance_note text;

alter table company_os.client_backlog_items drop constraint if exists client_backlog_items_variance_reason_check;
alter table company_os.client_backlog_items add constraint client_backlog_items_variance_reason_check
  check (variance_reason is null or variance_reason in
    ('client_delayed', 'deal_not_finalised', 'reprioritised', 'external', 'other'));

create index if not exists client_backlog_items_quarterly_plan_idx
  on company_os.client_backlog_items (quarterly_plan_id) where quarterly_plan_id is not null;

comment on column company_os.client_backlog_items.quarterly_plan_id is 'The 90-day plan this target belongs to; null = not tied to a quarter.';
comment on column company_os.client_backlog_items.quantity_target is 'Numeric target for the quarter (e.g. 10 for "10 posts/qtr"); progress is counted from linked marketing_content.';
comment on column company_os.client_backlog_items.variance_reason is 'Why the target slipped, if it did. Valid values: [client_delayed, deal_not_finalised, reprioritised, external, other]';
comment on column company_os.client_backlog_items.variance_note is 'Client-facing explanation of the variance.';

-- ─── program_plans = LinkedIn strategy ───────────────────────────────────
alter table company_os.program_plans drop constraint if exists program_plans_method_check;
alter table company_os.program_plans add constraint program_plans_method_check
  check (method in ('upload', 'chat', 'linkedin_strategy'));

alter table company_os.program_plans
  add column if not exists published_at timestamptz;

comment on column company_os.program_plans.method is 'How the plan was produced. linkedin_strategy = the signed-off LinkedIn content strategy (pillars, post types, cadence in brief_html). Valid values: [upload, chat, linkedin_strategy]';
comment on column company_os.program_plans.published_at is 'When the plan was made visible in the client hub; null = internal draft.';

-- ─── Workstream seed ──────────────────────────────────────────────────────
-- Keys match the rows the first client already carries. unique (company_id, key)
-- makes this a no-op where a company-wide row exists.
create or replace function company_os.seed_pr_workstreams(p_program_id uuid)
returns integer
language plpgsql
set search_path to 'company_os', 'extensions', 'pg_catalog'
as $$
declare
  v_company uuid;
  v_n integer := 0;
  v_row record;
begin
  select company_id into v_company from company_os.pr_programs where id = p_program_id;
  if v_company is null then
    raise exception 'seed_pr_workstreams: unknown program %', p_program_id;
  end if;

  for v_row in
    select * from (values
      ('news-announcements', 'News Announcements', 1),
      ('thought-leadership', 'Thought Leadership', 2),
      ('newsjacking', 'Media Relations & Newsjacking', 3),
      ('linkedin-authority', 'LinkedIn', 4),
      ('speaking', 'Speaking', 5),
      ('awards', 'Awards', 6)
    ) as t(key, title, sort_order)
  loop
    insert into company_os.client_roadmap_groups (company_id, pr_program_id, key, title, sort_order)
    values (v_company, p_program_id, v_row.key, v_row.title, v_row.sort_order)
    on conflict (company_id, key) do nothing;
    if found then v_n := v_n + 1; end if;
  end loop;

  return v_n;
end;
$$;

comment on function company_os.seed_pr_workstreams(uuid) is 'Inserts the standard PR workstreams (client_roadmap_groups) for a program; skips keys the company already has. Returns rows inserted.';

-- Backfill every existing program once.
do $$
declare p record;
begin
  for p in select id from company_os.pr_programs loop
    perform company_os.seed_pr_workstreams(p.id);
  end loop;
end $$;

commit;
