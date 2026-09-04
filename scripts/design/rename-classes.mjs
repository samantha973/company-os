#!/usr/bin/env node
// Renames CSS classes BY EXACT NAME across a stylesheet and the .tsx files
// that consume it. Only class contexts are touched in TSX — className strings,
// className template literals, classList calls — so identifiers, enum values
// and prose that happen to share a word are never renamed.
//
//   node scripts/design/rename-classes.mjs <map.tsv> <stylesheet> [tsx roots…]
//   map.tsv: one "old<TAB>new" per line.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const [, , mapFile, stylesheet, ...roots] = process.argv;
if (!mapFile || !stylesheet) { console.error("usage: rename-classes.mjs <map.tsv> <stylesheet> [tsx roots…]"); process.exit(2); }
const map = new Map(readFileSync(mapFile, "utf8").split("\n").filter(Boolean).map((l) => l.split("\t")));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// `${expr}` segments inside a template literal are code (styles.eyebrow, a
// variable), never class tokens: leave them untouched.
const renameTokens = (s) =>
  s.split(/(\$\{[^}]*\})/).map((part, i) => (i % 2 === 1 ? part : part.replace(/(?<![\w-])([A-Za-z_][\w-]*)(?![\w-])/g, (m) => (map.has(m) ? map.get(m) : m)))).join("");

// Stylesheet: every .class selector token.
let css = readFileSync(stylesheet, "utf8");
let cssHits = 0;
css = css.replace(/(?<![\w-])\.([A-Za-z_][\w-]*)/g, (m, c) => { if (map.has(c)) { cssHits++; return `.${map.get(c)}`; } return m; });
writeFileSync(stylesheet, css);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) yield p;
  }
}
let tsxHits = 0, files = 0;
for (const root of roots.length ? roots : ["app", "components"]) {
  for (const f of walk(root)) {
    const src = readFileSync(f, "utf8");
    let out = src;
    out = out.replace(/(className=)("[^"]*")/g, (m, a, b) => a + '"' + renameTokens(b.slice(1, -1)) + '"');
    out = out.replace(/(className=\{`)([^`]*)(`\})/g, (m, a, b, c) => a + renameTokens(b) + c);
    out = out.replace(/(className=\{)("[^"]*"|'[^']*')(\})/g, (m, a, b, c) => a + b[0] + renameTokens(b.slice(1, -1)) + b[0] + c);
    out = out.replace(/(className=\{[^}]*?\?\s*)("[^"]*")(\s*:\s*)("[^"]*")/g, (m, a, b, c, d) => a + '"' + renameTokens(b.slice(1, -1)) + '"' + c + '"' + renameTokens(d.slice(1, -1)) + '"');
    out = out.replace(/(classList\.(?:add|remove|toggle|contains)\()("[^"]*")/g, (m, a, b) => a + '"' + renameTokens(b.slice(1, -1)) + '"');
    if (out !== src) { files++; tsxHits += (out.match(/site-/g) || []).length - (src.match(/site-/g) || []).length; writeFileSync(f, out); }
  }
}
console.log(`renamed ${cssHits} selector tokens in ${stylesheet}; touched ${files} source files`);
