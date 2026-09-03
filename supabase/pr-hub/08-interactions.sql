-- PR Hub M7: touchpoints are interactions rows.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M7). interactions is
-- THE activity log (docs/db/data-dictionary.md); a client-relationship
-- touchpoint is a row with company_id set, subject_type='pr_program',
-- subject_id=<program>. Internal-only: no portal reader exists. The
-- last-formal-catch-up on the program band is max(occurred_at) over
-- meeting/lunch/catchup kinds (09-views.sql).
--
-- Idempotent: re-running is a no-op.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/08-interactions.sql

begin;

alter table company_os.interactions drop constraint if exists interactions_kind_check;
alter table company_os.interactions add constraint interactions_kind_check
  check (kind in ('note', 'call', 'email', 'meeting', 'message', 'status_change', 'system',
                  'lunch', 'gift', 'catchup'));

comment on column company_os.interactions.kind is 'What kind of touch. lunch/gift/catchup are PR client-relationship touchpoints. Valid values: [note, call, email, meeting, message, status_change, system, lunch, gift, catchup]';
comment on column company_os.interactions.subject_type is 'Polymorphic subject: deal, application, pr_program.';

commit;
