import vercelConfig from "@/vercel.json";

// Agent Management (Settings → Agents): one pane over every managed routine we
// run, unified across hosts. A "managed agent" here is a scheduled worker with
// four things worth seeing at a glance: the CONTENT it reads, the SKILL (or
// route) it follows, the ROUTINE (schedule) it runs on, and the APPS it talks
// to.
//
// Two hosts feed this page:
//   - Vercel: the crons in vercel.json. Their schedules are read LIVE from that
//     file (the source of truth), so a schedule change there shows here with no
//     edit; the human-facing metadata (what each reads, which apps it touches)
//     is enriched below by cron path. A cron with no enrichment still renders,
//     flagged, rather than being silently dropped.
//   - Local: Claude Desktop scheduled-tasks captured from ~/.claude/scheduled-
//     tasks. These are a snapshot (see CAPTURE below), not a live read: a page
//     deployed on Vercel cannot read a personal machine's filesystem at request
//     time.
//
// Policy: routines belong on the Mac mini, never on a laptop. Any routine whose
// observed host is a laptop is a violation and is surfaced as such.

export type RoutineHost = "vercel" | "mac-mini" | "laptop";

export type RoutineStatus = "active" | "paused" | "one-time" | "manual";

export type Routine = {
  id: string;
  name: string;
  description: string;
  host: RoutineHost;
  // Where the routine physically runs, in words (e.g. the exact machine a local
  // routine was captured on). Vercel routines just say "Vercel".
  hostLabel: string;
  // Human schedule ("Weekdays 07:00 UTC"). For Vercel routines this is derived
  // live from the cron expression in vercel.json.
  schedule: string;
  // Raw cron expression when there is one (Vercel crons; some local routines).
  cron?: string;
  // The data / subjects it reads.
  content: string[];
  // The skill it follows (local) or the route handler that is its logic (Vercel).
  skill: string;
  // Connected apps / services.
  apps: string[];
  status: RoutineStatus;
};

// When and from where the local snapshot below was captured. Shown on the page
// so its staleness is never a mystery.
export const LOCAL_CAPTURE = {
  at: "2026-09-04",
  from: "none — no local routines are registered for this account",
  path: "~/.claude/scheduled-tasks",
} as const;

// ── Vercel cron enrichment ────────────────────────────────────────────────
// Keyed by the cron `path` in vercel.json. Schedules are NOT stored here (they
// come live from vercel.json); only the human metadata that the raw cron entry
// cannot carry. Descriptions and apps are drawn from each route's own header.
type CronMeta = { name: string; description: string; content: string[]; apps: string[] };

const CRON_META: Record<string, CronMeta> = {};

// ── Local routines (snapshot) ─────────────────────────────────────────────
// Captured from ~/.claude/scheduled-tasks on David's MacBook Pro. host is set
// to what was OBSERVED, not what is intended: these are on a laptop today, which
// is a policy violation the page is meant to make loud. Move them to the Mac
// mini and re-capture with host: "mac-mini".
const LAPTOP = LOCAL_CAPTURE.from;

export const LOCAL_ROUTINES: Routine[] = [];

// ── Cron → human schedule ─────────────────────────────────────────────────
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Best-effort, readable rendering of the cron shapes we actually use. Falls
// back to the raw expression rather than guessing on anything exotic.
export function cronToHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return expr;
  const [min, hour, dom, mon, dow] = parts;

  const everyN = min.match(/^\*\/(\d+)$/);
  if (everyN && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `Every ${everyN[1]} minutes`;
  }
  if (min === "*" && hour === "*" && dom === "*" && mon === "*" && dow === "*") {
    return "Every minute";
  }

  const mm = /^\d+$/.test(min) ? min.padStart(2, "0") : null;
  const hh = /^\d+$/.test(hour) ? hour.padStart(2, "0") : null;
  const time = mm && hh ? `${hh}:${mm} UTC` : null;

  // Hourly at a given minute.
  if (hh === null && mm && dom === "*" && mon === "*" && dow === "*") {
    return `Hourly at :${mm} UTC`;
  }

  let when = "";
  if (dow !== "*" && /^\d+$/.test(dow)) when = `${DOW[Number(dow) % 7]}`;
  else if (dom !== "*" && /^\d+$/.test(dom)) when = `Day ${dom} of the month`;
  else when = "Daily";

  return time ? `${when}, ${time}` : `${when} (${expr})`;
}

// ── Loader ────────────────────────────────────────────────────────────────
export type AgentManagementView = {
  routines: Routine[];
  vercel: Routine[];
  local: Routine[];
  counts: { total: number; vercel: number; macMini: number; laptop: number };
  // Routines that break the "no routines on laptops" policy.
  violations: Routine[];
  capture: typeof LOCAL_CAPTURE;
};

export function loadAgentManagement(): AgentManagementView {
  const crons = (vercelConfig.crons ?? []) as { path: string; schedule: string }[];

  const vercel: Routine[] = crons.map((c) => {
    const meta = CRON_META[c.path];
    return {
      id: c.path,
      name: meta?.name ?? c.path,
      description:
        meta?.description ??
        "No metadata yet for this cron. Add it to CRON_META in lib/admin/agent-management.ts.",
      host: "vercel",
      hostLabel: "Vercel",
      schedule: cronToHuman(c.schedule),
      cron: c.schedule,
      content: meta?.content ?? [],
      skill: `app${c.path}route.ts`,
      apps: meta?.apps ?? [],
      status: "active",
    };
  });

  const local = LOCAL_ROUTINES;
  const routines = [...vercel, ...local];
  const laptop = routines.filter((r) => r.host === "laptop");
  const macMini = routines.filter((r) => r.host === "mac-mini");

  return {
    routines,
    vercel,
    local,
    counts: {
      total: routines.length,
      vercel: vercel.length,
      macMini: macMini.length,
      laptop: laptop.length,
    },
    violations: laptop,
    capture: LOCAL_CAPTURE,
  };
}
