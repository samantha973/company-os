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

## Migration status

The consolidation is landing surface by surface. Each PR replaces that
surface's private prefix with shared classes, removes its inline styles, and
deletes the old CSS. Order:

1. Foundation — tokens, utilities, guardrail (this document) ✅
2. Client Hub — admin, team, portal (`hub-`, `plan-`, `sap-`, `mp-`, `board-`)
3. Client Hubs list, Companies, Contacts, Dashboard, Settings (`appdet-`, `deal-`, `staff-`, `assume-`, `portal-`)
4. Revenue — deals, leads, marketing, events (`mcr-`, `lead-`, `book-`)
5. Talent — jobs, applications, team (`hire-`, `loop-`)
6. Team intranet — coaching, goals, ideas, gallery, hiring, strategy (`coach-`, `mycoach-`, `goal-`, `goals-`, `cg-`, `edges-`, `idea-`, `ideas-`, `ts-`, `tp-`, `dir-`, `gallery-`, `phototag-`)
7. Assistant widget (`chatw-`), then delete every prefix that no longer has a consumer.
