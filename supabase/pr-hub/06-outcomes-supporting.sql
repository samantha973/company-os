-- PR Hub M6/M7: awards, news pipeline, case studies.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M6 pr_awards, M7
-- pr_news_pipeline + pr_case_studies). Coverage and LinkedIn posts are NOT
-- here — they are marketing_content rows (07-marketing-content.sql).
-- Every table copies the meetings convention: published_at null = internal
-- draft, set = visible in the client hub.
--
-- Idempotent: re-running is a no-op.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/06-outcomes-supporting.sql

begin;

-- ─── pr_case_studies (created first: marketing_content references it) ─────
create table if not exists company_os.pr_case_studies (
  id                  uuid primary key default gen_random_uuid(),
  pr_program_id       uuid not null references company_os.pr_programs(id) on delete cascade,
  company_id          uuid not null references company_os.companies(id) on delete cascade,
  title               text not null,
  customer_person_id  uuid references company_os.people(id) on delete set null,
  customer_company_id uuid references company_os.companies(id) on delete set null,
  description         text,
  status              text not null default 'proposed',
  published_at        timestamptz,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  archived_by         text,
  constraint pr_case_studies_status_check check (status in ('proposed', 'in_progress', 'approved', 'used'))
);

create index if not exists pr_case_studies_program_idx on company_os.pr_case_studies (pr_program_id);
create index if not exists pr_case_studies_company_idx on company_os.pr_case_studies (company_id);

alter table company_os.pr_case_studies enable row level security;
grant select, insert, update, delete on company_os.pr_case_studies to service_role;
grant select on company_os.pr_case_studies to chatbot_reader;
grant select, insert, update on company_os.pr_case_studies to chatbot_writer;

comment on table company_os.pr_case_studies is 'One row is a customer story the client can offer to media: who the customer is (a people row, never inline PII), what the story is, and whether it has been used. "Used in" = marketing_content rows with case_study_id set.';
comment on column company_os.pr_case_studies.pr_program_id is 'Program the story belongs to.';
comment on column company_os.pr_case_studies.company_id is 'Denormalised client company for scope checks.';
comment on column company_os.pr_case_studies.title is 'Short working title for the story.';
comment on column company_os.pr_case_studies.customer_person_id is 'people.id of the customer contact (PII lives on people, internal-only).';
comment on column company_os.pr_case_studies.customer_company_id is 'companies.id of the customer organisation, if it has one.';
comment on column company_os.pr_case_studies.description is 'The story in a paragraph.';
comment on column company_os.pr_case_studies.status is 'Where the story stands. Valid values: [proposed, in_progress, approved, used]';
comment on column company_os.pr_case_studies.published_at is 'When shown in the client hub; null = internal draft.';
comment on column company_os.pr_case_studies.created_by is 'Email of the creator.';
comment on column company_os.pr_case_studies.archived_at is 'Soft delete; null = live.';
comment on column company_os.pr_case_studies.archived_by is 'Who archived it.';

-- ─── pr_awards ─────────────────────────────────────────────────────────────
create table if not exists company_os.pr_awards (
  id                     uuid primary key default gen_random_uuid(),
  pr_program_id          uuid not null references company_os.pr_programs(id) on delete cascade,
  company_id             uuid not null references company_os.companies(id) on delete cascade,
  quarterly_plan_id      uuid references company_os.pr_quarterly_plans(id) on delete set null,
  stage                  text not null default 'proposed',
  award_name             text not null,
  category               text,
  website                text,
  entry_close            date,
  event_date             date,
  submission_document_id uuid references company_os.program_documents(id) on delete set null,
  cost_cents             integer,
  outcome_note           text,
  published_at           timestamptz,
  created_by             text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  archived_at            timestamptz,
  archived_by            text,
  constraint pr_awards_stage_check check (stage in ('proposed', 'agreed', 'submitted', 'shortlisted', 'won', 'lost', 'withdrawn'))
);

create index if not exists pr_awards_program_idx on company_os.pr_awards (pr_program_id);
create index if not exists pr_awards_company_idx on company_os.pr_awards (company_id);

alter table company_os.pr_awards enable row level security;
grant select, insert, update, delete on company_os.pr_awards to service_role;
grant select on company_os.pr_awards to chatbot_reader;
grant select, insert, update on company_os.pr_awards to chatbot_writer;

comment on table company_os.pr_awards is 'One row is one award entry for a program, from proposed through outcome. A single stage column replaces the v0.5 proposed/agreed lists.';
comment on column company_os.pr_awards.pr_program_id is 'Program the entry belongs to.';
comment on column company_os.pr_awards.company_id is 'Denormalised client company for scope checks.';
comment on column company_os.pr_awards.quarterly_plan_id is 'The 90-day plan this entry was proposed in, if any.';
comment on column company_os.pr_awards.stage is 'Where the entry stands. Valid values: [proposed, agreed, submitted, shortlisted, won, lost, withdrawn]';
comment on column company_os.pr_awards.award_name is 'Name of the award programme.';
comment on column company_os.pr_awards.category is 'Category entered.';
comment on column company_os.pr_awards.website is 'Award website URL.';
comment on column company_os.pr_awards.entry_close is 'Entry deadline.';
comment on column company_os.pr_awards.event_date is 'Ceremony/announcement date.';
comment on column company_os.pr_awards.submission_document_id is 'program_documents.id of the submitted entry.';
comment on column company_os.pr_awards.cost_cents is 'Internal-only entry cost in cents.';
comment on column company_os.pr_awards.outcome_note is 'Result detail once known.';
comment on column company_os.pr_awards.published_at is 'When shown in the client hub; null = internal draft.';
comment on column company_os.pr_awards.created_by is 'Email of the creator.';
comment on column company_os.pr_awards.archived_at is 'Soft delete; null = live.';
comment on column company_os.pr_awards.archived_by is 'Who archived it.';

-- ─── pr_news_pipeline ──────────────────────────────────────────────────────
create table if not exists company_os.pr_news_pipeline (
  id                       uuid primary key default gen_random_uuid(),
  pr_program_id            uuid not null references company_os.pr_programs(id) on delete cascade,
  company_id               uuid not null references company_os.companies(id) on delete cascade,
  headline                 text not null,
  description              text,
  status                   text not null default 'logged',
  target_quarter_plan_id   uuid references company_os.pr_quarterly_plans(id) on delete set null,
  promoted_backlog_item_id uuid references company_os.client_backlog_items(id) on delete set null,
  last_reviewed_on         date,
  published_at             timestamptz,
  created_by               text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  archived_at              timestamptz,
  archived_by              text,
  constraint pr_news_pipeline_status_check check (status in ('logged', 'candidate', 'promoted', 'parked'))
);

create index if not exists pr_news_pipeline_program_idx on company_os.pr_news_pipeline (pr_program_id);
create index if not exists pr_news_pipeline_company_idx on company_os.pr_news_pipeline (company_id);

alter table company_os.pr_news_pipeline enable row level security;
grant select, insert, update, delete on company_os.pr_news_pipeline to service_role;
grant select on company_os.pr_news_pipeline to chatbot_reader;
grant select, insert, update on company_os.pr_news_pipeline to chatbot_writer;

comment on table company_os.pr_news_pipeline is 'One row is a news idea logged against a program before it becomes a plan target. Promote = create the client_backlog_items target and set promoted_backlog_item_id.';
comment on column company_os.pr_news_pipeline.pr_program_id is 'Program the idea belongs to.';
comment on column company_os.pr_news_pipeline.company_id is 'Denormalised client company for scope checks.';
comment on column company_os.pr_news_pipeline.headline is 'Working headline.';
comment on column company_os.pr_news_pipeline.description is 'What the story is and why it matters.';
comment on column company_os.pr_news_pipeline.status is 'Pipeline state. Valid values: [logged, candidate, promoted, parked]';
comment on column company_os.pr_news_pipeline.target_quarter_plan_id is 'The 90-day plan the idea is aimed at.';
comment on column company_os.pr_news_pipeline.promoted_backlog_item_id is 'The plan target created when the idea was promoted.';
comment on column company_os.pr_news_pipeline.last_reviewed_on is 'Last time the team looked at this idea.';
comment on column company_os.pr_news_pipeline.published_at is 'When shown in the client hub; null = internal draft.';
comment on column company_os.pr_news_pipeline.created_by is 'Email of the creator.';
comment on column company_os.pr_news_pipeline.archived_at is 'Soft delete; null = live.';
comment on column company_os.pr_news_pipeline.archived_by is 'Who archived it.';

commit;
