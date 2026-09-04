# Design-system debt — audit, backlog, results

Reference contract: `docs/product/design-system.md`. Token file:
`app/styles/tokens.css`. Guardrails: `scripts/design/check-tokens.mjs`,
`scripts/design/check-assets.mjs`, `scripts/check-design-ratchet.mjs`.
Converters: `scripts/design/inline-to-classes.pl`, `scripts/design/smart-inline.pl`.

Measured 4 Sep 2026 on `main` at `58fcdb41`. The "after" column is filled in
as each backlog item lands.

## Before / after

| # | Measure | Before | After |
|---|---|---|---|
| 1 | Inline `style={{}}` blocks (app + components) | 104 — 22 styled, 82 layout-only (44 marked `layout-ok`) | |
| 2 | Class prefixes: `admin.css` | `admin-*`, `u-*`, plus 1 stray `.phototag` | |
| 2 | Class prefixes: `globals.css` | 66 page prefixes, 722 classes, **656 with no consumer** | |
| 2 | Private stylesheets | 3 CSS modules (`home`, `event`, `survey`) with camelCase classes | |
| 3 | Raw colours outside `tokens.css` + `palette.ts` | 173 across 17 files (home.module.css 45, ogRender 17, email.ts 17, portal-invite 14, api email routes 28, marketing-email 8, sign-in links 10, contractor-notify 5, talent actions 3, onboarding 1, survey/event modules 2, page.tsx 1) | |
| 4 | Off-scale font sizes (CSS) | 15 values, 82 declarations (10px ×26, 17px ×22, 19px ×8, 9px ×7 …) | |
| 4 | Off-scale spacing (CSS) | 26 values, 263 declarations (7px ×32, 22px ×32, 36px ×26, 5px ×24, 9px ×23 …) | |
| 5 | Page-level widths off the sanctioned 640/880/1440 | 2 in components (360, 320); 7 in the patterns page demos | |
| 6 | Components with private `<style>` / styled-jsx | 0 (the 3 CSS modules above are the only private styling) | |
| 7 | CSS variables used but never defined | 3: `--font-dm-sans`, `--font-playfair`, `--font-mono` (`--n` is a deliberate column-count variable) | |
| 7 | `var(--x, #hex)` fallbacks hiding missing tokens | 0 | |
| 8 | Colours in shared TS lists / database | TS: only `lib/design/palette.ts` (by design). DB: `tags.color` column exists, empty | |
| 9 | Overlapping component classes | progress ×4 families, avatar ×6, box ×4, tag/chip/pill ×5 (list below) | |
| 10 | Non-browser painters reading the palette module | 0 of 11 (OG, QR, 9 email builders all carry their own hex) | |
| — | Vercel functions region = Supabase region | ✅ `syd1` / ap-southeast-2 | ✅ |
| — | CI running the design guardrails | none (no `.github/workflows`) | |

### Commands used

```bash
# 1 inline styles, per area, styled vs layout-only
grep -rho 'style={{' app components lib --include='*.tsx' | wc -l
grep -rhoE 'style=\{\{[^}]*\b(color|background|backgroundColor|border|borderColor|borderTop|borderBottom|borderLeft|borderRight|borderRadius|fontFamily|boxShadow|outline)\s*:' app components --include='*.tsx' | wc -l
# 2 prefixes per stylesheet, rule counts
grep -oE '^\s*\.[a-zA-Z][a-zA-Z0-9]*(-|\b)' app/globals.css | sort | uniq -c | sort -rn
# 2 dead classes: every class in globals.css with no exact consumer in any .tsx
perl -ne 'while(/(?<![\w-])\.([A-Za-z][\w-]*)/g){print "$1\n"}' app/globals.css | sort -u   # then grep -P "(?<![\w-])NAME(?![\w-])" over all .tsx
# 3 raw colours by file (token file excluded)
grep -rnoE '#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)' app components lib --include='*.tsx' --include='*.ts' --include='*.css' --include='*.js' | grep -v app/styles/tokens.css | grep -vE 'unicode-range|url\(' | cut -d: -f1 | sort | uniq -c | sort -rn
# 4 off-scale values (scales from check-assets.mjs)
grep -hoE 'font-size:\s*[0-9.]+px' app/**/*.css | grep -oE '[0-9.]+' | sort | uniq -c | sort -rn
grep -hoE '\b(gap|padding|margin)[a-z-]*:\s*[^;]+' app/**/*.css | grep -oE '[0-9]+px' | sort | uniq -c | sort -rn
# 5 page widths
grep -rnoE 'maxWidth:\s*"?[0-9]{3,4}' app components --include='*.tsx' | grep -vE '(640|880|1440)'
# 6 private styles
grep -rlE '<style jsx|<style>' app components --include='*.tsx'; find app components -name '*.module.css'
# 7 undefined variables (defined = every --x: declaration, including several per line)
perl -ne 'while(/(--[A-Za-z0-9-]+)\s*:/g){print "$1\n"}' app/**/*.css | sort -u > defined; perl -ne 'while(/var\((--[A-Za-z0-9-]+)/g){print "$1\n"}' $(find app components lib -name '*.css' -o -name '*.tsx' -o -name '*.ts') | sort -u > used; comm -13 defined used
# 8 colours in TS / DB
grep -rnE '"#[0-9a-fA-F]{6}"' lib --include='*.ts'; psql … "select table_name, column_name from information_schema.columns where table_schema='company_os' and column_name ilike '%color%'"
# 9 overlaps
for p in progress avatar box card badge chip pill tag meter callout alert; do grep -ohE "^\.[a-z-]*${p}[a-z-]*" app/**/*.css | sort -u; done
# 10 painters
grep -rlE 'ImageResponse|satori|qrcode|<html|<body' lib app; grep -rl "design/palette" lib app
```

The full script is `scripts/design/measure-debt.sh`; run it before and after.

### Overlapping component classes (item 9)

| Job | Families today | Keep |
|---|---|---|
| Progress bar | `.admin-progress(-fill)`, `.admin-meter(-fill, --thin/--thick/--flat)`, `.admin-campaign-progress(-track/-fill/-num)`, `.admin-plan-progress(-n)` | `.admin-meter` (sizes as modifiers); the others become aliases then go |
| Avatar | `.admin-avatar-img/-initials/-lg`, `.admin-avatarbtn`, `.admin-board-avatar-*`, `.admin-coach-avatar`, `.admin-kanban-avatar`, `.admin-team-*-avatar` | `.admin-avatar` + size/tone modifiers |
| Box / inset | `.admin-box`, `.admin-box-pad`, `.admin-callout`, `.admin-panel-soft` | `.admin-box` + `--pad`, `--accent`, `--soft` |
| Small label | `.admin-badge`, `.admin-chip`, `.admin-pill`, `.admin-tag-pill`, `.admin-tag-xs` | `.admin-badge` (status), `.admin-chip` (filter/link), `.admin-tag` (inline label) — three jobs, three classes |

## Backlog

Order: guardrails and tokens → renames → per-surface inline → scales → consolidation → long tail. One PR each.

| # | What | Where | Count | Fix | PR |
|---|---|---|---|---|---|
| 1 | Guardrails and CI | `scripts/`, `.github/workflows` | 0 CI jobs today | Adopt the reference `check-tokens.mjs` (PR-number false positives), add `check-design-ratchet.mjs` + baseline, `measure-debt.sh`, a `check` script and a CI job running typecheck + the three design gates; styled ceiling = 21 | #37 |
| 2 | Undefined tokens and the stray prefix | `tokens.css`, `admin.css` | 3 vars, 1 class | Define `--font-mono` / retire `--font-dm-sans` and `--font-playfair` at their call sites; `.phototag` → `.admin-phototag` | #38 |
| 3 | Painters read the palette | `lib/ogRender.js`, `lib/qr.ts`, 9 email builders, 3 api email routes | 11 files, ~80 hex | Extend `lib/design/palette.ts` with the email greys; every painter imports it; check-tokens stops exempting them | #39 |
| 4 | Dead public-site CSS | `app/globals.css` | 656 of 722 classes, ~3,000 lines | Delete every rule whose classes have no consumer | #40 |
| 5 | Public-site prefix rename | `app/globals.css`, `components/experience/*`, legal/unsubscribe pages | 66 live classes across `xp-`, `btn-`, `hero-`, … | Rename by exact class name into `site-*`; ratchet page-prefix count to 0 | #41 |
| 6 | CSS modules on tokens | `app/home.module.css`, `events/[slug]/event.module.css`, `surveys/[slug]/survey.module.css` | 47 raw colours | Replace every colour with a token (color-mix for alpha); modules stay scoped, no private aliases | #42 |
| 7 | Remaining inline styles | admin patterns page, `DocumentsView`, `CompanyDocuments`, public pages | 22 styled + 38 unmarked layout | Converters + hand-finish; only data-driven values remain, each marked | #43 |
| 8 | Scale normalisation | `admin.css`, `globals.css`, modules | 82 font + 263 spacing declarations | Snap to the documented scales (10→11, 17→16, 19→18, 9→11 …; 7→8, 22→24, 36→32, 5→4 …); check-assets off-scale warnings → 0 | #44 |
| 9 | Consolidate overlapping components | `admin.css` + consumers | 4 families, 19 classes | Per the table above; rename consumers by exact class name; delete the losers | #45 |
| 10 | Long tail | `DocumentsView`, `CompanyDocuments`, patterns page, `tags.color` | 2 widths, 7 demo widths, 1 DB column | Widths → `u-max-*`; demo widths → utilities; document that `tags.color` holds a token name, never hex | #46 |
| 11 | Close-out | this doc | — | Re-run `measure-debt.sh`, fill the After column, lower all ceilings/baselines to zero where reached | #47 |
