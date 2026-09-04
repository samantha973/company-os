# Design system — how it works now

One system, one place for every visual decision. This page is the contract;
the older `edge8-design-system*.md` files describe the look and are still the
reference for *why*, but where they disagree with this page on *where things
live*, this page wins.

## Where things live

| What | Where | Rule |
|---|---|---|
| Colours, type ramp, spacing, radii, shadows | `app/styles/tokens.css` | The **only** file allowed to contain a raw colour. Change a value here and it changes everywhere. |
| Brand hex for non-browser renderers (OG images, QR, email) | `lib/design/palette.ts` | Mirrors §1 of `tokens.css`. Keep in sync by hand. |
| App component classes (`.admin-*`, `.u-*`) | `app/admin/admin.css` | Reads tokens by name. No hex, no rgba. Loaded by admin, team and portal. |
| Public-site classes | `app/globals.css` | Same rule. Translucent colours use `color-mix()` over a token. |
| Pattern library | `/admin/patterns` | Renders every token and component. If a screen doesn't look like this page, the screen is wrong. |
| Guardrail | `npm run check:tokens` (runs as `prebuild`) | Fails on any raw colour outside `tokens.css` / `palette.ts`, and on the styled-inline count rising above its ceiling. |

## Token layers

1. `--color-*` — the palette itself. Raw values. Never used directly by a
   component; only by the layers below.
2. `--blue`, `--mint`, `--dark`, `--tint` … — short aliases the public
   marketing pages use.
3. `--admin-*` — semantic roles for the operating-system surfaces (admin,
   team, portal). **Components use these.** Examples: `--admin-ink`,
   `--admin-muted`, `--admin-line`, `--admin-surface-2`, `--admin-accent`,
   `--admin-ok-bg` / `--admin-ok-ink`, `--admin-radius-sm`,
   `--admin-space-3`, `--admin-text-sm`, `--admin-shadow-md`.

The former `--data-*` layer is gone; its values are now the `--admin-*`
definitions themselves.

## Writing UI

- **Use the shared components first**: `PageHead`, `Tabs`, `MetricCard`
  (KPI), `Badge`, `DataTable`, `DetailDrawer`, `KanbanBoard`, `InlineEdit`,
  `PersonSelect`, `ConfirmButton`. Buttons are `.admin-btn` with
  `--primary`, `--danger`, `--sm`. Chips are `.admin-chip`; pills `.admin-pill`.
- **Layout without inline styles**: `.u-row`, `.u-stack`, `.u-wrap`,
  `.u-between`, `.u-grow`, `.u-grid-2/3/4`, `.u-gap-1…6`, `.u-mt-*`, `.u-mb-*`,
  `.u-muted`, `.u-sm`, `.u-strong`, `.u-truncate`, `.u-label`. Spacing steps are
  4 / 8 / 12 / 16 / 24 / 32.
- **No inline `style={{ color | background | border | borderRadius | fontFamily | boxShadow }}`.**
  Put it in a class. Layout-only inline styles are tolerated during the
  migration; the check reports the count and it must not go up.
- **A new feature gets no new prefix.** Compose from the classes above; if a
  genuinely new component is needed, add it to `admin.css` under the
  Components section and to `/admin/patterns` in the same PR.

## Migration status — complete (3 Sep 2026)

Every surface now runs on the one system. `app/admin/admin.css` carries two
namespaces only: `.admin-*` (components) and `.u-*` (layout utilities). The
27 per-feature prefixes are gone — each was renamed by exact class name into
`.admin-<component>-*` and its consumers updated.

| PR | Surface |
|---|---|
| #21 | Foundation — tokens, utilities, guardrail |
| #22 | Client Hub — admin, team, portal |
| #26 | Dashboard, Client Hubs list, Companies, Contacts, Settings, shared components |
| #27 | Revenue — deals, leads, marketing, events, invoices, affiliates |
| #28 | Talent, Operations, Company, Edges, Boards |
| #29 | Team intranet, client portal, assistant widget |

What remains inline, and why it stays: data-driven values only — progress
bar widths, runtime series/stage colours (already token variables), avatar
sizes from props, a CSS variable carrying a column count, and hidden file
inputs. Each carries a `/* layout-ok: reason */` comment. The guardrail
ceilings are set to today's counts, so they can only go down.

**Adding a new screen:** compose from the classes above. If a pattern truly
needs a new class, add it to the end of `admin.css` under the relevant
component section and to `/admin/patterns` in the same PR. Never a new prefix,
never a raw colour, never an inline colour/border/font.

## Rolling out to another repo

`scripts/design/inline-to-classes.pl` (exact patterns) and
`scripts/design/smart-inline.pl` (maps any fully-recognised `style={{}}` to
utilities and merges it into the element's className) did most of the
migration here. Sequence per repo: measure → foundation PR (tokens, utilities,
`check:tokens` as prebuild) → rename prefixes by exact class name → run both
converters per surface → hand-finish the colour/border leftovers as component
classes → refresh baselines, build, eyeball, merge.
