-- PR Hub Phase 4: seed EM Advisory as the first PR client.
--
-- Idempotent. Parent rows (company, people, program, board, roadmap groups) are
-- looked up by natural key and created only when missing. Child rows that this
-- script fully owns (backlog items for the seeded workstreams, the board's
-- tasks + columns, all coverage for the company, the seeded Drive links, the Q3
-- plan) are deleted within their seeded scope and re-inserted, so running twice
-- yields exactly one copy of each and never a duplicate.
--
-- Run AFTER 01-rename.sql and 02-extensions.sql:
--   psql ... -v ON_ERROR_STOP=1 -f supabase/pr-hub/03-seed-em-advisory.sql
--
-- Source of truth: the EM Advisory account sheet (tabs Account Home, Quarterly
-- Plan, Media Coverage). URLs were pulled from the xlsx export (the CSV export
-- strips the hyperlinks the "HERE" cells point at).

begin;

do $$
declare
  v_company uuid;
  v_program uuid;
  v_board   uuid;
  v_col_progress uuid;
  v_col_done     uuid;
  v_natasha uuid;
  v_kylie   uuid;
  seed_email text := 'seed@edge8.co';
begin
  ------------------------------------------------------------------------
  -- Company: EM Advisory
  ------------------------------------------------------------------------
  select id into v_company from company_os.companies where name = 'EM Advisory';
  if v_company is null then
    insert into company_os.companies (name, lifecycle_stage) values ('EM Advisory', 'client')
      returning id into v_company;
  end if;
  update company_os.companies set
    client_types = (select array(select distinct unnest(coalesce(client_types,'{}') || array['pr']))),
    is_pr_program = true,
    country = coalesce(country, 'Australia'),
    metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'pr', jsonb_build_object(
        'contract_start', '2026-05-18',
        'contract_end',   '2026-08-31',
        'account_health', 'green',
        'wip_cadence',    'Wed 12pm (fortnightly)',
        'current_quarter','Q3',
        'quarterly_planning_date', '2026-08-17'
      )
    )
  where id = v_company;

  ------------------------------------------------------------------------
  -- Contacts: Natasha Mandie (primary), Kylie Favero (accounts)
  ------------------------------------------------------------------------
  select id into v_natasha from company_os.people where email = 'natasha@emadvisory.com';
  if v_natasha is null then
    insert into company_os.people (email, full_name, first_name, last_name, persona)
      values ('natasha@emadvisory.com', 'Natasha Mandie', 'Natasha', 'Mandie', 'client')
      returning id into v_natasha;
  end if;

  select id into v_kylie from company_os.people where email = 'kylie@emadvisory.com';
  if v_kylie is null then
    insert into company_os.people (email, full_name, first_name, last_name, persona)
      values ('kylie@emadvisory.com', 'Kylie Favero', 'Kylie', 'Favero', 'client')
      returning id into v_kylie;
  end if;

  -- person_companies links (idempotent on person+company)
  if not exists (select 1 from company_os.person_companies where person_id=v_natasha and company_id=v_company) then
    insert into company_os.person_companies (person_id, company_id, role, title, is_primary)
      values (v_natasha, v_company, 'primary', 'Managing Director', true);
  end if;
  if not exists (select 1 from company_os.person_companies where person_id=v_kylie and company_id=v_company) then
    insert into company_os.person_companies (person_id, company_id, role, title, is_primary)
      values (v_kylie, v_company, 'secondary', 'Accounts', false);
  end if;

  -- portal_members: Natasha admin, Kylie viewer (idempotent on person+company)
  if not exists (select 1 from company_os.portal_members where person_id=v_natasha and company_id=v_company) then
    insert into company_os.portal_members (person_id, company_id, role, status, invited_by)
      values (v_natasha, v_company, 'admin', 'active', seed_email);
  end if;
  if not exists (select 1 from company_os.portal_members where person_id=v_kylie and company_id=v_company) then
    insert into company_os.portal_members (person_id, company_id, role, status, invited_by)
      values (v_kylie, v_company, 'viewer', 'active', seed_email);
  end if;

  ------------------------------------------------------------------------
  -- PR Program: "PR Retainer"
  ------------------------------------------------------------------------
  select id into v_program from company_os.pr_programs where company_id=v_company and name='PR Retainer';
  if v_program is null then
    insert into company_os.pr_programs (company_id, name, status, created_by)
      values (v_company, 'PR Retainer', 'active', seed_email)
      returning id into v_program;
  end if;

  ------------------------------------------------------------------------
  -- Quarterly workstreams: 5 roadmap groups + one agreed-priority item each
  ------------------------------------------------------------------------
  -- Groups: guarded insert per key (no unique constraint on (company_id,key),
  -- so guard explicitly to stay idempotent without duplicating).
  insert into company_os.client_roadmap_groups (company_id, key, title, intro, sort_order)
  select v_company, g.key, g.title, g.intro, g.sort_order
  from (values
    ('news-announcements', 'News Announcements', 'Deal and funding announcements placed with tier media.', 1),
    ('thought-leadership',  'Thought Leadership', 'Bylines and expert commentary that build category authority.', 2),
    ('newsjacking',         'Newsjacking',        'Fast reactive commentary tied to breaking stories.', 3),
    ('linkedin-authority',  'LinkedIn/Authority', 'Spokesperson posting cadence on LinkedIn.', 4),
    ('speaking',            'Speaking Opportunities', 'Strategic speaking events and panels.', 5)
  ) as g(key, title, intro, sort_order)
  where not exists (
    select 1 from company_os.client_roadmap_groups
    where company_id = v_company and key = g.key
  );

  -- Agreed-priority items (this script owns these five group_keys for this company)
  delete from company_os.client_backlog_items
    where company_id = v_company
      and group_key in ('news-announcements','thought-leadership','newsjacking','linkedin-authority','speaking');
  insert into company_os.client_backlog_items
    (company_id, pr_program_id, group_key, title, client_priority, edge8_priority, status, source, client_note, sort_order)
  values
    (v_company, v_program, 'news-announcements', '1-2 news announcements per quarter', 'now',  'now',  'active',   'edge8', 'Q3 targets: Eagers; Foundational AI / LLM funding; Biotech transaction (timing Sept TBC).', 1),
    (v_company, v_program, 'thought-leadership',  '2 (min) pieces of coverage per quarter', 'now',  'now',  'active',   'edge8', 'Bylines and expert commentary.', 2),
    (v_company, v_program, 'newsjacking',         '1-2 (min) newsjacking opportunities per quarter', 'next', 'next', 'active',   'edge8', 'Reactive commentary on breaking stories.', 3),
    (v_company, v_program, 'linkedin-authority',  '10 posts per quarter', 'now',  'now',  'active',   'edge8', 'Spokesperson LinkedIn cadence.', 4),
    (v_company, v_program, 'speaking',            'Identify 1-2 (min) strategic speaking events per quarter', 'later','later','accepted', 'edge8', 'Speaking pipeline in build.', 5);

  ------------------------------------------------------------------------
  -- Media opportunities in progress: board + 3 tasks
  ------------------------------------------------------------------------
  select id into v_board from company_os.boards where client_company_id=v_company and slug='em-advisory-media-opportunities';
  if v_board is null then
    insert into company_os.boards (name, slug, description, client_company_id, pr_program_id, status)
      values ('EM Advisory — Media Opportunities', 'em-advisory-media-opportunities',
              'Live media and speaking opportunities in progress.', v_company, v_program, 'active')
      returning id into v_board;
  else
    update company_os.boards set pr_program_id = v_program where id = v_board;
  end if;

  -- Rebuild columns + tasks for the seeded board (tasks reference columns, so
  -- delete tasks first).
  delete from company_os.tasks where board_id = v_board;
  delete from company_os.board_columns where board_id = v_board;
  insert into company_os.board_columns (board_id, name, position, is_done)
    values (v_board, 'In Progress', 0, false) returning id into v_col_progress;
  insert into company_os.board_columns (board_id, name, position, is_done)
    values (v_board, 'Complete', 1, true) returning id into v_col_done;

  insert into company_os.tasks (title, description, board_id, board_column_id, status, completed_at, metadata)
  values
    ('Inner Sanctum Podcast',
     'Opportunity with Natasha on her story.',
     v_board, v_col_progress, 'open', null,
     jsonb_build_object('outlet','Inner Sanctum Podcast','format','Podcast','timing','Oct TBC - TPH to reach out and confirm timings in Oct')),
    ('SMB Tech Byline',
     'Byline: AI Is Giving Founders Deal Confidence Before Deal Judgement.',
     v_board, v_col_progress, 'open', null,
     jsonb_build_object('outlet','SMB Tech','format','Byline','timing','Client to sign off - TPH to submit')),
    ('Inner Chief Podcast',
     'Podcast with Natasha.',
     v_board, v_col_done, 'done', now(),
     jsonb_build_object('outlet','Inner Chief Podcast','format','Podcast','timing','Complete - TPH to share coverage link once live'));

  ------------------------------------------------------------------------
  -- Approved quarterly plan: Q3 (sign-off in progress -> signed_off_at null)
  ------------------------------------------------------------------------
  delete from company_os.program_plans where pr_program_id = v_program and quarter = 'Q3';
  insert into company_os.program_plans (pr_program_id, title, method, quarter, signed_off_at, created_by, brief_html)
    values (v_program, 'EM Advisory 90-Day PR Plan', 'upload', 'Q3', null, seed_email,
            '<p>Approved quarterly plan tracked in the account sheet and the linked Gamma doc. Sign-off in progress.</p>');

  ------------------------------------------------------------------------
  -- Source-of-truth links (Google Drive et al) as link documents
  ------------------------------------------------------------------------
  delete from company_os.program_documents where company_id = v_company and source = 'link';
  insert into company_os.program_documents
    (company_id, storage_path, external_url, source, filename, uploaded_by)
  values
    (v_company, null, 'https://drive.google.com/drive/folders/1pkEQWumjvL5lLQH4CET-MHpEvo_350KZ', 'link', 'Client folder', seed_email),
    (v_company, null, 'https://drive.google.com/file/d/1m6F41sX_iwy4NRlHLN_RGUdJOWK58Px-/view?usp=drivesdk', 'link', 'Signed contract', seed_email),
    (v_company, null, 'https://gamma.app/docs/EM-Advisory-90-Day-Strategy-Plan-rdyfsbyempm3ayx?mode=doc', 'link', 'Current approved quarterly PR plan', seed_email),
    (v_company, null, 'https://docs.google.com/document/d/1wmBpofhEmKiSB3gLwxn5WuNvN90fk2qLeWMNFlGIyq4/edit?tab=t.0', 'link', 'Messaging / strategy document', seed_email),
    (v_company, null, 'https://docs.google.com/document/d/1vW05Fr1nhrDFyvsWZUn82v9mUMKIQSVM3oqk_F82M28/edit?tab=t.0', 'link', 'WIP notes / EOW', seed_email),
    (v_company, null, 'https://docs.google.com/document/d/1z6ZSj_-KY8OYUjJJhKNP65CkURAAtSjJjLPKR3wiSYs/edit?tab=t.0', 'link', 'Pitches', seed_email),
    (v_company, null, 'https://docs.google.com/spreadsheets/d/17eHl7c4AmcqH23PlcHUvhn11CaFj3B9jYwVd5UWKRTs/edit?gid=0', 'link', 'Speaking Engagement Tracker', seed_email);

  ------------------------------------------------------------------------
  -- Media coverage log: 16 rows (this script owns all coverage for the company)
  ------------------------------------------------------------------------
  delete from company_os.marketing_content where company_id = v_company;
  insert into company_os.marketing_content
    (company_id, title, channel, status, publish_date, outlet, reach, posted_url, notes, created_by)
  values
    (v_company, 'LInkedin -  AI is making judgement the most valuable asset in corporate and M&A advisory', 'linkedin', 'published', '2026-08-26', 'Consultancy Linkedin', null, 'https://www.linkedin.com/feed/update/urn:li:share:7498352363720658944', null, seed_email),
    (v_company, 'AI is making judgement the most valuable asset in corporate and M&A advisory', 'earned', 'published', '2026-08-26', 'Consultancy', null, 'https://www.consultancy.com.au/news/12625/ai-is-making-judgement-the-most-valuable-asset-in-corporate-and-ma-advisory', null, seed_email),
    (v_company, 'GolfTrak teams up with EM Advisory again for merger with US-based ChipIn', 'linkedin', 'published', '2026-08-24', 'Consultancy Linkedin', null, 'https://www.linkedin.com/posts/golftrak-teams-up-with-em-advisory-again-share-7497593714618531840-BN8-/?utm_source=share&utm_medium=member_android&rcm=ACoAABB_5KIBLqHlciYkhHwohJQkANxjc6CcB0g', null, seed_email),
    (v_company, 'Australia’s GolfTrak Joins US Platform ChipIn to Drive Global Expansion', 'earned', 'published', '2026-08-11', 'Golf Industry Central', null, 'https://www.golfindustrycentral.com.au/golf-industry-news/australias-golftrak-joins-us-platform-chipin-to-drive-global-expansion/', null, seed_email),
    (v_company, 'GolfTrak teams up with EM Advisory again for merger with US-based ChipIn', 'earned', 'published', '2026-08-07', 'Consultancy', null, 'https://www.consultancy.com.au/news/12592/golftrak-teams-up-with-em-advisory-again-for-merger-with-us-based-chipin', null, seed_email),
    (v_company, 'GolfTrak, ChipIn merge in cross-border golf technology deal', 'earned', 'published', '2026-08-07', 'Channle Life', 136000, 'https://channellife.com.au/story/golftrak-chipin-merge-in-cross-border-golf-technology-deal', 'Spokesperson: Joseph Gabriel Lagonsin', seed_email),
    (v_company, 'GolfTrak, ChipIn merge in cross-border golf technology deal', 'earned', 'published', '2026-08-07', 'IT Brief', 136000, 'https://itbrief.com.au/story/golftrak-chipin-merge-in-cross-border-golf-technology-deal', 'Spokesperson: Joseph Gabriel Lagonsin', seed_email),
    (v_company, 'GolfTrak, ChipIn merge in cross-border golf technology deal', 'earned', 'published', '2026-08-07', 'CFO Tech', 136000, 'https://cfotech.com.au/story/golftrak-chipin-merge-in-cross-border-golf-technology-deal', 'Spokesperson: Joseph Gabriel Lagonsin', seed_email),
    (v_company, 'GolfTrak, ChipIn merge in cross-border golf technology deal', 'earned', 'published', '2026-08-07', 'Europe Says', 136000, 'https://www.europesays.com/golf/47693/?utm', 'Spokesperson: Joseph Gabriel Lagonsin', seed_email),
    (v_company, 'Talking Business #26 Interview with Natasha Mandie from EM Advisory', 'podcast', 'published', '2026-07-31', 'Talking Business with Leon Gettler', null, 'https://podcasts.apple.com/au/podcast/talking-business-26-interview-with-natasha-mandie-from/id1349585824?i=1000779168738', 'Spokesperson: Leon Gettler', seed_email),
    (v_company, 'Let’s Talk: I might sell my business in a few years, where do I start with a valuation?', 'earned', 'published', '2026-07-22', 'Dynamic Business', 60000, 'https://dynamicbusiness.com/leadership-2/lets-talk-business/lets-talk-i-might-sell-my-business-in-a-few-years-where-do-i-start-with-a-valuation.html', 'Spokesperson: Yajush Gupta', seed_email),
    (v_company, 'Carro buys majority stake in CarPlace for Australia', 'earned', 'published', '2026-07-09', 'IT Brief', 136000, 'https://itbrief.com.au/story/carro-buys-majority-stake-in-carplace-for-australia', 'Spokesperson: Mark Tarre', seed_email),
    (v_company, 'Carro buys majority stake in CarPlace for Australia', 'earned', 'published', '2026-07-09', 'E Commerce News', 136000, 'https://ecommercenews.com.au/story/carro-buys-majority-stake-in-carplace-for-australia', 'Spokesperson: Mark Tarre', seed_email),
    (v_company, 'Carro buys majority stake in CarPlace for Australia', 'earned', 'published', '2026-07-09', 'Channle Life', 136000, 'https://channellife.com.au/story/carro-buys-majority-stake-in-carplace-for-australia', 'Spokesperson: Mark Tarre', seed_email),
    (v_company, 'Carro buys majority stake in CarPlace for Australia', 'earned', 'published', '2026-07-09', 'Future Five', 136000, 'https://futurefive.com.au/story/carro-buys-majority-stake-in-carplace-for-australia', 'Spokesperson: Mark Tarre', seed_email),
    (v_company, 'Autoleague sells majority stake in CarPlace as Carro enters Australia', 'earned', 'published', '2026-07-07', 'Autotalk', 1000, 'https://autotalk.com.au/industry-news/autoleague-sells-majority-stake-in-carplace-as-carro-enters-australia', null, seed_email);

  raise notice 'EM Advisory seeded: company=%, program=%, board=%', v_company, v_program, v_board;
end $$;

commit;
