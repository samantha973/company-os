-- PR Hub M3: client contacts, spokespeople and media contacts on people.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M3). There is no
-- contacts table — a contact is a people row joined to a company through
-- person_companies. A journalist is people.persona='media' joined to the
-- outlet's companies row with role='journalist'; one journalist covering
-- several clients is one row. credential_ref is a password-manager item
-- reference, never a secret.
--
-- Idempotent: re-running is a no-op.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/04-people.sql

begin;

alter table company_os.people drop constraint if exists people_persona_check;
alter table company_os.people add constraint people_persona_check
  check (persona is null or persona in
    ('vendor', 'prospect', 'client', 'job_seeker', 'employee', 'student', 'media'));

alter table company_os.people
  add column if not exists birthday date,
  add column if not exists key_topics text[] not null default '{}',
  add column if not exists linkedin_handle text,
  add column if not exists credential_ref text;

comment on column company_os.people.persona is 'CRM lifecycle tag; media = journalist/editor/producer. Valid values: [vendor, prospect, client, job_seeker, employee, student, media]';
comment on column company_os.people.birthday is 'Birthday for client-relationship touchpoints (PR Hub Key Facts).';
comment on column company_os.people.key_topics is 'Topics a spokesperson can speak to; empty for non-spokespeople.';
comment on column company_os.people.linkedin_handle is 'LinkedIn handle used when the agency posts on the person''s behalf.';
comment on column company_os.people.credential_ref is 'Password-manager item reference (e.g. a 1Password item URL) for the person''s LinkedIn login. Never a password.';

alter table company_os.person_companies drop constraint if exists person_companies_role_check;
alter table company_os.person_companies add constraint person_companies_role_check
  check (role in ('owner_founder', 'executive', 'employee', 'primary', 'secondary',
                  'board', 'advisor', 'other', 'accounts', 'spokesperson', 'journalist'));

comment on column company_os.person_companies.role is 'Relationship to the company. Client contacts: primary/accounts/spokesperson. Media: journalist at an outlet. Valid values: [owner_founder, executive, employee, primary, secondary, board, advisor, other, accounts, spokesperson, journalist]';

commit;
