# PR Hub — Client Record on the existing Client Hub (v1.0)

Rendered at `public/plans/client-activity-record.html` (replaced the v0.5 page
in place). Same principles, rebased onto the tables that actually exist.
Audience: Dave + Claude.

Decisions taken 2026-09-03:

1. **Activity = `tasks`.** No separate activity table. The client Work Board *is*
   the effort log.
2. **Coverage + LinkedIn posts = `marketing_content`**, extended. 90-day plan
   targets will link to content rows.
3. **Media contacts = `people`** (new persona `media`), outlet = a `companies`
   row via `person_companies`.

## The spine, mapped to real tables

| Layer | Concept | Table | Status |
|---|---|---|---|
| Anchor | client | `companies` | extend |
| Anchor | engagement | `pr_programs` | extend |
| Anchor | client personnel | `people` + `person_companies` | extend |
| Plan | 90-day plan | `pr_quarterly_plans` | **new** |
| Plan | workstream lookup | `client_roadmap_groups` | reuse (seed) |
| Plan | plan target | `client_backlog_items` | extend |
| Plan | LinkedIn strategy | `program_plans` (`method='linkedin_strategy'`) | extend |
| Effort | activity | `tasks` | extend (metadata) |
| Outcome | coverage, LinkedIn post | `marketing_content` | extend |
| Outcome | award | `pr_awards` | **new** |
| Supporting | news pipeline | `pr_news_pipeline` | **new** |
| Supporting | case study | `pr_case_studies` | **new** |
| Supporting | touchpoint | `interactions` | extend (kind) |
| Supporting | media contact | `people` | extend (persona) |
| Derived | counts, last catch-up, scorecard | views | **new** |

Four new tables, not twelve.

## Visibility — one rule, stated once

There is no `in_client_hub` toggle in the platform. The admin "Internal /
Client Hub" switch is a `?view=` param
(`app/admin/(dashboard)/revenue/companies/[id]/page.tsx:68`). Visibility is
enforced by *which loader reads the row*: `lib/admin/*` (everything),
`lib/team/*` (assigned staff, everything), `lib/portal/*` (client, filtered).

Per-row client visibility uses the existing flags, and new tables copy the
`meetings` convention:

| Table | Flag | Meaning |
|---|---|---|
| `tasks` | `internal boolean` | true = never leaves `/team` |
| `meetings` | `published_at timestamptz` | null = internal draft |
| `staff_assignments` | `client_visible boolean` | |
| `marketing_content` | `published_at` (exists) | **reuse** — client sees only published |
| `pr_awards`, `pr_news_pipeline`, `pr_case_studies`, `pr_quarterly_plans` | `published_at timestamptz` | **new, same convention** |

Internal-only *columns* (`engagement_fee`, `account_health`,
`internal_drive_folder`, case-study PII) are simply never in a `lib/portal/*`
select. `interactions` and media-persona `people` have no portal reader at all.

## Migrations (against the live DB — `01-schema.sql` is stale)

Known drift: `marketing_content.company_id/outlet/reach` and
`program_documents.source/external_url` exist live but not in the dump. Take a
fresh `pg_dump --schema-only` before writing any of these.

### M1 — `companies`
```sql
alter table company_os.companies
  add column linkedin_url text,
  add column abn text,
  add column office_address text;
```
(`website_url`, `industry_normalized`, `size_band`, `country`, `priority` exist.)

### M2 — `pr_programs`
```sql
alter table company_os.pr_programs
  add column account_lead_id uuid references company_os.people(id),
  add column strategic_lead_id uuid references company_os.people(id),
  add column account_health text check (account_health in ('green','amber','red')),
  add column contract_start date,
  add column contract_review date,
  add column engagement_fee_cents integer,
  add column client_drive_folder text,
  add column internal_drive_folder text;
-- status: add 'paused'
alter table company_os.pr_programs drop constraint pr_programs_status_check;
alter table company_os.pr_programs add constraint pr_programs_status_check
  check (status in ('draft','active','paused','complete'));
```
Leave `repo_url` / `github_repo*` in place (other code reads them); hide from
the PR UI. `last_formal_catchup`, `coverage_count`, `linkedin_post_count` are
**views, not columns** (see Views).

### M3 — `people` / `person_companies`
```sql
alter table company_os.people drop constraint people_persona_check;
alter table company_os.people add constraint people_persona_check
  check (persona is null or persona in
    ('vendor','prospect','client','job_seeker','employee','student','media'));
alter table company_os.people
  add column birthday date,
  add column key_topics text[] not null default '{}',   -- spokesperson topics
  add column linkedin_handle text,
  add column credential_ref text;                        -- 1Password item ref, never a secret

alter table company_os.person_companies drop constraint person_companies_role_check;
alter table company_os.person_companies add constraint person_companies_role_check
  check (role in ('owner_founder','executive','employee','primary','secondary',
                  'board','advisor','other','accounts','spokesperson','journalist'));
```
- Client contact = `person_companies(company_id=client, role=primary|accounts|spokesperson)`.
- Media contact = `people.persona='media'` + `person_companies(company_id=outlet, role='journalist', title=beat)`.
  A journalist who covers several clients is one `people` row — the v0.5 open
  question is closed by the existing many-to-many.
- `worked_with_before` / `stories_run` = derived from `marketing_content`
  rows that reference the journalist (see M6).

### M4 — Plan layer

**`pr_quarterly_plans` (new)**
```sql
create table company_os.pr_quarterly_plans (
  id uuid primary key default gen_random_uuid(),
  pr_program_id uuid not null references company_os.pr_programs(id),
  company_id uuid not null references company_os.companies(id),
  quarter_label text not null,                -- 'Q4 FY26'
  starts_on date not null,
  ends_on date not null,
  planning_meeting_id uuid references company_os.meetings(id), -- the meeting the plan is keyed off
  business_objective text,
  comms_objective text,
  approved_plan_md text,
  signoff_date date,
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz, archived_by text,
  unique (pr_program_id, quarter_label)
);
```
The transcript is on the meeting, not the plan: `meetings` already has
`transcript_url`, `recording_url`, `minutes_url`, `summary`, the AI-summary
status and `published_at`. The 90-day planning session is logged as a
`meetings` row (Lark/upload, same as today), and the plan row points at it.
Objectives and targets can be drafted from that transcript by the existing
meeting-extract path (`lib/meeting-extract.ts`).

**`client_roadmap_groups` = workstreams.** No schema change. Seed per program:
`news_announcements`, `thought_leadership`, `media_relations`, `linkedin`,
`awards`, `speaking` (as `key`), with `title` as the display name.

**`client_backlog_items` = plan targets.**
```sql
alter table company_os.client_backlog_items
  add column quarterly_plan_id uuid references company_os.pr_quarterly_plans(id),
  add column quantity_target integer,          -- "10 posts/qtr" -> 10
  add column variance_reason text check (variance_reason in
    ('client_delayed','deal_not_finalised','reprioritised','external','other')),
  add column variance_note text;
```
`group_key` → workstream, `status` (proposed/accepted/active/shipped/parked)
already fits, `edge8_priority`/`client_priority` already give now/next/later.
Variance lives on the *target* (the thing that slipped), with `tasks` carrying
the day-to-day status note.

**LinkedIn strategy = `program_plans`.**
```sql
alter table company_os.program_plans drop constraint program_plans_method_check;
alter table company_os.program_plans add constraint program_plans_method_check
  check (method in ('upload','chat','linkedin_strategy'));
alter table company_os.program_plans
  add column signoff_date date,
  add column published_at timestamptz;
```
Content pillars / post types / cadence are sections of `brief_html`. If we later
need them structured, they become `marketing_pillars` rows keyed to the
program — not now.

### M5 — Effort layer: `tasks`

No columns. PR-specific fields go in `tasks.metadata` (jsonb, exists):

```jsonc
{
  "pr": {
    "type": "announcement | proactive_pitch | reactive | newsjack | speaking",
    "status_note": "client-facing one-liner",
    "link": "https://…"
  }
}
```
- Link to the plan: `subject_type='client_backlog_item'`, `subject_id=<target>`
  (pattern already used, `lib/admin/company-hub.ts:54-63`).
- Client visibility: `internal` boolean (exists).
- Board columns already model the status ladder; map:
  planned → pitching → in progress → waiting on client → waiting on external → done.
  "Not proceeding" = archived with a variance on the target.
- Owner = `assignee_id`, date = `due_date` / `completed_at`.

### M6 — Outcome layer: `marketing_content`
```sql
alter table company_os.marketing_content
  add column pr_program_id uuid references company_os.pr_programs(id),
  add column task_id uuid references company_os.tasks(id),          -- the effort that earned it
  add column backlog_item_id uuid references company_os.client_backlog_items(id), -- the target it counts toward
  add column journalist_person_id uuid references company_os.people(id),
  add column case_study_id uuid references company_os.pr_case_studies(id),
  add column media_asset_document_id uuid references company_os.program_documents(id);
-- company_id, outlet, reach, posted_url, publish_date, published_at exist live.
alter table company_os.marketing_content drop constraint marketing_content_channel_check;
alter table company_os.marketing_content add constraint marketing_content_channel_check
  check (channel in ('blog','email','linkedin','facebook',
                     'earned','online','print','tv','radio','podcast','syndication','speaking','other'));
```
- Coverage = any row with `company_id` and channel in the earned set.
- LinkedIn post = `channel='linkedin'`; `copy_md`, `social_style`, `image_url`
  already cover copy/post_type/has_image.
- Video/audio of a segment = a `program_documents` row (bucket exists), pointed
  to by `media_asset_document_id`.
- The Coverage tab (`lib/team/clients.ts:299`) already reads this table; it only
  needs `pr_program_id` in its filter.

**`pr_awards` (new)**
```sql
create table company_os.pr_awards (
  id uuid primary key default gen_random_uuid(),
  pr_program_id uuid not null references company_os.pr_programs(id),
  company_id uuid not null references company_os.companies(id),
  quarterly_plan_id uuid references company_os.pr_quarterly_plans(id),
  stage text not null default 'proposed'
    check (stage in ('proposed','agreed','submitted','won','shortlisted','lost','withdrawn')),
  award_name text not null,
  category text,
  website text,
  entry_close date,
  event_date date,
  submission_document_id uuid references company_os.program_documents(id),
  cost_cents integer,
  outcome_note text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz, archived_by text
);
```
Single `stage` field replaces proposed/agreed lists (kept from v0.5).

### M7 — Supporting

**`pr_news_pipeline` (new)**
```sql
create table company_os.pr_news_pipeline (
  id uuid primary key default gen_random_uuid(),
  pr_program_id uuid not null references company_os.pr_programs(id),
  company_id uuid not null references company_os.companies(id),
  headline text not null,
  description text,
  status text not null default 'logged'
    check (status in ('logged','candidate','promoted','parked')),
  target_quarter_plan_id uuid references company_os.pr_quarterly_plans(id),
  promoted_backlog_item_id uuid references company_os.client_backlog_items(id),
  last_reviewed_on date,
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz, archived_by text
);
```
"Promote" = create a `client_backlog_items` row and set
`promoted_backlog_item_id`.

**`pr_case_studies` (new)**
```sql
create table company_os.pr_case_studies (
  id uuid primary key default gen_random_uuid(),
  pr_program_id uuid not null references company_os.pr_programs(id),
  company_id uuid not null references company_os.companies(id),
  customer_person_id uuid references company_os.people(id),  -- PII lives on people
  customer_company_id uuid references company_os.companies(id),
  description text,
  location text,                     -- enum TBD; free text until values settle
  story_type text,                   -- enum TBD
  status text not null default 'proposed'
    check (status in ('proposed','in_progress','approved','used')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz, archived_by text
);
```
`used_in` = `marketing_content` rows where `case_study_id` matches (FK in M6).

**`interactions` = touchpoints.**
```sql
alter table company_os.interactions drop constraint interactions_kind_check;
alter table company_os.interactions add constraint interactions_kind_check
  check (kind in ('note','call','email','meeting','message','status_change','system',
                  'lunch','gift','catchup'));
```
Key to `company_id` + `subject_type='pr_program'`, `subject_id=<program>`.
Internal only — no portal reader exists and none is added.

### M8 — Views (nobody types a count)

```sql
create view company_os.pr_program_stats as
select p.id as pr_program_id,
  (select count(*) from company_os.marketing_content c
     where c.pr_program_id = p.id and c.channel = 'linkedin' and c.published_at is not null) as linkedin_post_count,
  (select count(*) from company_os.marketing_content c
     where c.pr_program_id = p.id and c.channel in ('earned','online','print','tv','radio','podcast','syndication','speaking')
       and c.published_at is not null) as coverage_count,
  (select max(i.occurred_at) from company_os.interactions i
     where i.subject_type = 'pr_program' and i.subject_id = p.id
       and i.kind in ('meeting','lunch','catchup')) as last_formal_catchup
from company_os.pr_programs p;
```
Plus, later, `pr_target_progress` (per backlog item: `quantity_target` vs
count of linked `marketing_content`) which is the EOS scorecard row.

## Loader surface

Reuse the three-module pattern. New reads land in:

- `lib/hub/program.ts` — extend `ProgramDetail` with `quarterlyPlans`, `awards`,
  `newsPipeline`, `caseStudies`, `stats`.
- `lib/team/clients.ts` — `getClientCoverageForActor` gains `programId` filter;
  add `getClientPlanForActor`.
- `lib/portal/pr-programs.ts` — client reads, `published_at is not null` only,
  never selecting internal columns.
- `lib/admin/audit.ts` `recordAudit` already handles any table by name.

Tabs: the team hub already has Overview / Work Board / Roadmap / Documents /
Coverage / Meetings / Invoices / Team. PR Hub adds **90-Day Plan** (quarterly
plan + targets + variance), **Awards**, **Pipeline**; Roadmap becomes the
workstream view of targets. Media contacts appear on the existing People/
Contacts pages filtered by `persona='media'`.

## Build order

1. Fresh schema dump → M1–M3, M4 (`pr_quarterly_plans` + backlog columns), M8.
   Verify: seed one program end-to-end by SQL, `pr_program_stats` returns rows.
2. 90-Day Plan tab on `/team` + `/admin`: create plan, targets by workstream,
   variance on a target. Verify: a slipped target shows reason + note; portal
   shows it only after `published_at`.
3. M6 + Coverage tab: link a coverage row to a task and a target; tally moves.
   Verify: `coverage_count` and target progress change without editing a number.
4. M5 board conventions: `metadata.pr` on tasks, column ladder, "status note"
   surfaced to the portal for non-internal cards.
5. M7 awards / pipeline / case studies tabs.
6. Media contacts: persona + role, journalist link on coverage.

## Open questions (non-blocking)

- `location` / `story_type` enum values for case studies (carried over from
  v0.5, which listed them as "dropdown, values TBD").

Settled: one Work Board per program, with the PR column ladder
(planned → pitching → in progress → waiting → delivered). No per-program
column customisation.

## As built (3 Sep 2026)

Where the build departed from the migration sketch above:

- `program_plans` already had `quarter` and `signed_off_at` live; the
  LinkedIn strategy uses those (no `signoff_date` column) plus `published_at`.
- Workstream keys are the hyphenated ones the first client already carried
  (`news-announcements`, `thought-leadership`, `newsjacking`,
  `linkedin-authority`, `speaking`) plus `awards`; the seed function
  `seed_pr_workstreams(program_id)` inserts them per program and skips keys
  the company already has.
- `pr_program_stats` also carries `awards_in_flight`; `pr_target_progress`
  shipped now (not later) with outcome and board-card counts.
- Coverage rows seeded from the account sheet had `status='published'` and
  no `published_at`; `07-marketing-content.sql` backfills `published_at` so
  they count. The marketing calendar (`listEntries`) now excludes rows with
  `company_id` set — client outcomes live in the hubs, not the agency plan.
- Outcomes never hard-delete: `status='skipped'` removes a row from view.
- Case studies: no `location` / `story_type`. `used_in` is
  `marketing_content.case_study_id`.
- Roadmap UI removed end to end (team tab, portal page, admin
  `edges/client-roadmaps`, roadmap-assist API); Human Token fields removed
  from the board, sprint view and card editor (`tasks.human_tokens` stays in
  the DB, unread).
- Migration files: `supabase/pr-hub/02-…09-*.sql`, idempotent, applied to
  `hfpjcqvszhpeeoueckcn`; `supabase/01-schema.sql` regenerated from live
  (`pg_dump --schema-only --no-owner --quote-all-identifiers
  --schema=company_os --schema=htt`, then the two `CREATE SCHEMA` lines
  re-commented).
