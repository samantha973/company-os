-- PR Hub Phase 5: assign Samantha to EM Advisory as an employee.
--
-- Seeds the DB rows that scope her to exactly one client on /team:
--   people  ->  team_members (active)  ->  staff_assignments (active, EM Advisory).
--
-- NOTE ON LOGIN: /team identity is keyed on people.auth_user_id (the Supabase
-- auth subject), never email (lib/team-auth.ts). This script does NOT create the
-- Supabase auth user — that is done by the admin "Invite" action
-- (app/admin/.../talent/team, which calls the auth admin API and links
-- auth_user_id). So after this runs:
--   * If Samantha already has a linked auth account, she can sign in at /team.
--   * If not, invite her once from /admin (Talent -> Team) using the SAME email;
--     the invite links auth_user_id onto the people row this script created.
--
-- Requires her email on the command line (idempotent, re-runnable):
--   psql ... -v ON_ERROR_STOP=1 -v samantha_email='samantha@example.com' \
--            -f supabase/pr-hub/04-seed-samantha.sql

\if :{?samantha_email}
\else
  \echo '*** Set -v samantha_email=... (the address Samantha signs in with). Aborting.'
  \quit
\endif

begin;

do $$
declare
  v_email   text := lower(:'samantha_email');
  v_person  uuid;
  v_member  uuid;
  v_company uuid;
begin
  select id into v_company from company_os.companies where name = 'EM Advisory';
  if v_company is null then
    raise exception 'EM Advisory not found — run 03-seed-em-advisory.sql first.';
  end if;

  -- Person
  select id into v_person from company_os.people where email = v_email;
  if v_person is null then
    insert into company_os.people (email, full_name, first_name, is_team_member, persona)
      values (v_email, 'Samantha', 'Samantha', true, 'employee')
      returning id into v_person;
  else
    update company_os.people set is_team_member = true where id = v_person;
  end if;

  -- Active employment record
  select id into v_member from company_os.team_members
    where person_id = v_person and status = 'active' limit 1;
  if v_member is null then
    insert into company_os.team_members (person_id, status, employment_type)
      values (v_person, 'active', 'full_time')
      returning id into v_member;
  end if;

  -- Active, client-visible assignment to EM Advisory as Account Lead
  if not exists (
    select 1 from company_os.staff_assignments
    where team_member_id = v_member and company_id = v_company and status = 'active'
  ) then
    insert into company_os.staff_assignments
      (company_id, team_member_id, role_title, status, client_visible)
      values (v_company, v_member, 'Account Lead', 'active', true);
  end if;

  raise notice 'Samantha assigned: person=%, team_member=%, company=%', v_person, v_member, v_company;
end $$;

commit;
