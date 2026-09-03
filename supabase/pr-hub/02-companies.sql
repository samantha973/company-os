-- PR Hub M1: client-record fields on companies.
--
-- Plan: docs/plans/2026-09-03-pr-hub-client-record.md (M1). The client
-- record stays anchored on companies; these are the Key Facts fields the
-- v0.5 sheet carried that had no home. website_url, industry_normalized,
-- size_band, country and priority already exist.
--
-- Idempotent: re-running is a no-op.
--
-- Apply with:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/02-companies.sql

begin;

alter table company_os.companies
  add column if not exists linkedin_url text,
  add column if not exists abn text,
  add column if not exists office_address text;

comment on column company_os.companies.linkedin_url is 'Company LinkedIn page URL (PR Hub Key Facts).';
comment on column company_os.companies.abn is 'Australian Business Number as printed on invoices and award entries.';
comment on column company_os.companies.office_address is 'Office address, free text, one line per line (PR Hub Key Facts).';

commit;
