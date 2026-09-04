#!/usr/bin/env node
// Removes every rule in a stylesheet whose selector classes have no consumer
// in any .tsx under app/ or components/. Element-only selectors (html, body,
// a, h1…) and at-rules other than @media are kept untouched; @media blocks are
// pruned rule by rule and dropped when empty.
//
//   node scripts/design/prune-dead-css.mjs app/globals.css          # rewrite in place
//   node scripts/design/prune-dead-css.mjs app/globals.css --dry    # report only
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const [, , target, ...flags] = process.argv;
if (!target) { console.error("usage: prune-dead-css.mjs <stylesheet> [--dry]"); process.exit(2); }
const dry = flags.includes("--dry");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) yield p;
  }
}
const corpus = [...walk("app"), ...walk("components")].map((f) => readFileSync(f, "utf8")).join("\n");
// A class is live when it appears as a whole token inside a string context
// (className="…", template literals, classList strings). A bare word in a
// comment or prose ("post", "case") does not keep a rule alive.
const isLive = (cls) => new RegExp(`(?<=["'\`\\s{])${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=["'\`\\s}])`).test(corpus);
const liveCache = new Map();
const live = (cls) => { if (!liveCache.has(cls)) liveCache.set(cls, isLive(cls)); return liveCache.get(cls); };

// Minimal CSS block parser: returns nodes {kind:"rule"|"at", prelude, body, children}
function parse(css) {
  const nodes = [];
  let i = 0;
  const n = css.length;
  while (i < n) {
    // comments
    if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i + 2); const end = e === -1 ? n : e + 2; nodes.push({ kind: "comment", text: css.slice(i, end) }); i = end; continue; }
    if (/\s/.test(css[i])) { let j = i; while (j < n && /\s/.test(css[j])) j++; nodes.push({ kind: "ws", text: css.slice(i, j) }); i = j; continue; }
    // read prelude up to { or ;
    let j = i; let depth = 0;
    while (j < n && !(css[j] === "{" && depth === 0) && !(css[j] === ";" && depth === 0)) { if (css[j] === "(") depth++; if (css[j] === ")") depth--; j++; }
    const prelude = css.slice(i, j).trim();
    if (j >= n) { nodes.push({ kind: "raw", text: css.slice(i) }); break; }
    if (css[j] === ";") { nodes.push({ kind: "raw", text: css.slice(i, j + 1) }); i = j + 1; continue; }
    // block: find matching }
    let k = j + 1; let d = 1;
    while (k < n && d > 0) { if (css[k] === "{") d++; else if (css[k] === "}") d--; k++; }
    const body = css.slice(j + 1, k - 1);
    if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
      nodes.push({ kind: "at", prelude, children: parse(body) });
    } else if (prelude.startsWith("@")) {
      nodes.push({ kind: "raw", text: css.slice(i, k) });
    } else {
      nodes.push({ kind: "rule", prelude, body });
    }
    i = k;
  }
  return nodes;
}

let removedRules = 0, keptRules = 0;
const removedClasses = new Set();
function ruleIsLive(prelude) {
  const selectors = prelude.split(",").map((s) => s.trim()).filter(Boolean);
  // A rule survives if ANY of its selectors survives. A selector survives if it
  // names no class at all (element/attribute/pseudo only) or every class in it is live.
  return selectors.some((sel) => {
    const classes = [...sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
    if (classes.length === 0) return true;
    const ok = classes.every(live);
    if (!ok) classes.filter((c) => !live(c)).forEach((c) => removedClasses.add(c));
    return ok;
  });
}
function serialize(nodes) {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "comment" || node.kind === "ws" || node.kind === "raw") { out += node.text; continue; }
    if (node.kind === "rule") {
      if (ruleIsLive(node.prelude)) {
        keptRules++;
        // Drop the dead selectors from a selector list that survives on a live one.
        const kept = node.prelude.split(",").map((s) => s.trim()).filter((sel) => {
          const classes = [...sel.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
          return classes.length === 0 || classes.every(live);
        });
        out += `${kept.join(", ")} {${node.body}}`;
      } else removedRules++;
      continue;
    }
    if (node.kind === "at") {
      const inner = serialize(node.children);
      if (inner.trim()) out += `${node.prelude} {${inner}}`;
    }
  }
  return out;
}

const src = readFileSync(target, "utf8");
let out = serialize(parse(src));
// Collapse runs of blank lines left behind and orphaned section comments that
// now head nothing (a comment immediately followed by another comment or EOF).
out = out.replace(/\n{3,}/g, "\n\n");
out = out.replace(/(\/\*[^*]*\*\/\n)(?=\s*\/\*|\s*$)/g, "");
out = out.replace(/\n{3,}/g, "\n\n");
console.log(`${target}: kept ${keptRules} rules, removed ${removedRules} rules (${removedClasses.size} dead classes); ${src.split("\n").length} → ${out.split("\n").length} lines`);
if (!dry) writeFileSync(target, out);
