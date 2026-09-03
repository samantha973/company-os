-- PR Hub M6: earned coverage and LinkedIn posts are marketing_content rows.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M6). marketing_content
-- is the one content table (docs/db/data-dictionary.md: "any new content
-- type is a channel/status value here, not a new table"). company_id,
-- outlet and reach already exist on the live database; they are added here
-- `if not exists` so a database built from the repo dump works too. The new
-- links connect an outcome back to the effort (task), the plan target it
-- counts toward, the journalist, the case study used, and a media asset.
--
-- Idempotent: re-running is a no-op.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/07-marketing-content.sql

begin;

alter table company_os.marketing_content
  add column if not exists company_id uuid references company_os.companies(id) on delete set null,
  add column if not exists outlet text,
  add column if not exists reach integer,
  add column if not exists pr_program_id uuid references company_os.pr_programs(id) on delete set null,
  add column if not exists task_id uuid references company_os.tasks(id) on delete set null,
  add column if not exists backlog_item_id uuid references company_os.client_backlog_items(id) on delete set null,
  add column if not exists journalist_person_id uuid references company_os.people(id) on delete set null,
  add column if not exists case_study_id uuid references company_os.pr_case_studies(id) on delete set null,
  add column if not exists media_asset_document_id uuid references company_os.program_documents(id) on delete set null;

create index if not exists marketing_content_company_id_idx
  on company_os.marketing_content (company_id) where company_id is not null;
create index if not exists marketing_content_pr_program_id_idx
  on company_os.marketing_content (pr_program_id) where pr_program_id is not null;
create index if not exists marketing_content_backlog_item_id_idx
  on company_os.marketing_content (backlog_item_id) where backlog_item_id is not null;

alter table company_os.marketing_content drop constraint if exists marketing_content_channel_check;
alter table company_os.marketing_content add constraint marketing_content_channel_check
  check (channel in ('blog', 'email', 'linkedin', 'facebook',
                     'earned', 'online', 'print', 'tv', 'radio', 'podcast', 'syndication', 'speaking', 'other'));

-- Existing coverage rows were tagged to the company only; tag them to the
-- company's single program so program-scoped tallies include them.
update company_os.marketing_content mc
set pr_program_id = p.id
from company_os.pr_programs p
where mc.pr_program_id is null
  and mc.company_id = p.company_id
  and (select count(*) from company_os.pr_programs q where q.company_id = p.company_id) = 1;

-- Client coverage seeded from the account sheet carries status='published'
-- but no published_at. published_at is the client-hub visibility flag (the
-- meetings convention), so backfill it from the publish date.
update company_os.marketing_content
set published_at = coalesce(publish_date::timestamptz, created_at)
where company_id is not null
  and status = 'published'
  and published_at is null;

comment on column company_os.marketing_content.channel is 'Where the content ran. Owned channels: blog/email/linkedin/facebook. Earned coverage: earned/online/print/tv/radio/podcast/syndication/speaking/other. Valid values: [blog, email, linkedin, facebook, earned, online, print, tv, radio, podcast, syndication, speaking, other]';
comment on column company_os.marketing_content.company_id is 'Client company this content belongs to; null = the agency''s own marketing.';
comment on column company_os.marketing_content.outlet is 'Publication/outlet name for earned coverage.';
comment on column company_os.marketing_content.reach is 'Estimated audience reach for the placement.';
comment on column company_os.marketing_content.pr_program_id is 'PR program this outcome counts toward.';
comment on column company_os.marketing_content.task_id is 'The board card (effort) that earned this outcome.';
comment on column company_os.marketing_content.backlog_item_id is 'The 90-day plan target this outcome counts toward.';
comment on column company_os.marketing_content.journalist_person_id is 'people.id (persona=media) of the journalist who ran it; internal-only.';
comment on column company_os.marketing_content.case_study_id is 'pr_case_studies.id used in this piece, if any.';
comment on column company_os.marketing_content.media_asset_document_id is 'program_documents.id of a video/audio clip of the segment.';

commit;
