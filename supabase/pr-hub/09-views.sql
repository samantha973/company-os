-- PR Hub M8: derived numbers are views. Nobody types a count.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M8).
--   * pr_program_stats: per program — published LinkedIn posts, published
--     earned coverage, last formal catch-up.
--   * pr_target_progress: per plan target — quantity_target vs. counts of
--     linked published outcomes and linked board cards. This is the EOS
--     scorecard row.
--
-- Idempotent: create or replace.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/09-views.sql

begin;

create or replace view company_os.pr_program_stats as
select
  p.id as pr_program_id,
  p.company_id,
  (select count(*) from company_os.marketing_content c
     where c.pr_program_id = p.id
       and c.channel = 'linkedin'
       and c.published_at is not null) as linkedin_post_count,
  (select count(*) from company_os.marketing_content c
     where c.pr_program_id = p.id
       and c.channel in ('earned', 'online', 'print', 'tv', 'radio', 'podcast', 'syndication', 'speaking', 'other')
       and c.published_at is not null) as coverage_count,
  (select max(i.occurred_at) from company_os.interactions i
     where i.subject_type = 'pr_program'
       and i.subject_id = p.id
       and i.kind in ('meeting', 'lunch', 'catchup')) as last_formal_catchup,
  (select count(*) from company_os.pr_awards a
     where a.pr_program_id = p.id
       and a.archived_at is null
       and a.stage in ('agreed', 'submitted', 'shortlisted')) as awards_in_flight
from company_os.pr_programs p;

comment on view company_os.pr_program_stats is 'Derived per-program tallies for the hub band: published LinkedIn posts, published earned coverage, last formal catch-up, awards in flight. Read, never written.';

create or replace view company_os.pr_target_progress as
select
  b.id as backlog_item_id,
  b.quarterly_plan_id,
  b.pr_program_id,
  b.company_id,
  b.group_key,
  b.quantity_target,
  (select count(*) from company_os.marketing_content c
     where c.backlog_item_id = b.id
       and c.published_at is not null) as outcome_count,
  (select count(*) from company_os.tasks t
     where t.subject_type = 'client_backlog_item'
       and t.subject_id = b.id
       and t.archived_at is null) as task_count,
  (select count(*) from company_os.tasks t
     where t.subject_type = 'client_backlog_item'
       and t.subject_id = b.id
       and t.archived_at is null
       and t.completed_at is not null) as task_done_count
from company_os.client_backlog_items b
where b.archived_at is null;

comment on view company_os.pr_target_progress is 'Derived per-target progress for the 90-day plan: quantity_target vs. published outcomes linked to the target, plus board-card counts. The EOS scorecard row. Read, never written.';

grant select on company_os.pr_program_stats to service_role, chatbot_reader, chatbot_writer;
grant select on company_os.pr_target_progress to service_role, chatbot_reader, chatbot_writer;

commit;
