// The 90-Day Plan as a filter. Every hub surface (admin, team, portal) reads
// a `plan` query param: absent → the current quarter's plan, `all` → all
// time, a plan id → that quarter. "In scope that quarter" is decided here,
// once, so the band tiles, the tabs and the client hub all agree.
//
// Pure and client-safe: no imports from server modules.

export type ScopePlan = {
  id: string;
  quarter_label: string;
  starts_on: string;
  ends_on: string;
  published_at: string | null;
};

export type PlanScope = { mode: "all"; plan: ScopePlan | null } | { mode: "plan"; plan: ScopePlan };

export const ALL_TIME = "all";

// The plan whose quarter contains today, else the most recent one.
export function currentPlan<T extends ScopePlan>(plans: T[], today = new Date()): T | null {
  const iso = today.toISOString().slice(0, 10);
  const live = plans.find((p) => p.starts_on <= iso && p.ends_on >= iso);
  if (live) return live;
  return [...plans].sort((a, b) => (a.starts_on < b.starts_on ? 1 : -1))[0] ?? null;
}

// `param` is the raw `plan` query value. Unknown ids fall back to the current
// plan; with no plans at all the scope is all time.
export function resolvePlanScope<T extends ScopePlan>(plans: T[], param: string | null | undefined): PlanScope {
  const current = currentPlan(plans);
  if (param === ALL_TIME) return { mode: "all", plan: current };
  const picked = (param && plans.find((p) => p.id === param)) || current;
  return picked ? { mode: "plan", plan: picked } : { mode: "all", plan: null };
}

export function scopeParam(scope: PlanScope): string {
  return scope.mode === "all" ? ALL_TIME : scope.plan.id;
}

// For loaders that take a plan id: the scoped plan, or the current one when
// viewing all time (targets are always a single plan's).
export function scopePlanId(scope: PlanScope): string | null {
  return scope.plan?.id ?? null;
}

export function scopeLabel(scope: PlanScope): string {
  return scope.mode === "all" ? "all time" : scope.plan.quarter_label;
}

// A date (ISO date or timestamp) falls inside the scoped quarter. All time
// admits everything; a missing date is out of scope for a quarter.
export function inScope(scope: PlanScope, date: string | null | undefined): boolean {
  if (scope.mode === "all") return true;
  if (!date) return false;
  const d = date.slice(0, 10);
  return d >= scope.plan.starts_on && d <= scope.plan.ends_on;
}

// Coverage / LinkedIn posts: by publish date, else by when the row was made.
export function scopeOutcomes<T extends { publishDate: string | null; createdAt: string }>(rows: T[], scope: PlanScope): T[] {
  return rows.filter((r) => inScope(scope, r.publishDate ?? r.createdAt));
}

// Awards: tied to the plan they were proposed under, else by entry-close or
// event date, else by when they were logged.
export function scopeAwards<T extends { quarterlyPlanId: string | null; entryClose: string | null; eventDate: string | null; createdAt: string }>(
  rows: T[],
  scope: PlanScope,
): T[] {
  if (scope.mode === "all") return rows;
  return rows.filter(
    (a) => a.quarterlyPlanId === scope.plan.id || inScope(scope, a.entryClose) || inScope(scope, a.eventDate) || (!a.entryClose && !a.eventDate && inScope(scope, a.createdAt)),
  );
}

// Pipeline ideas: aimed at the quarter, or logged during it.
export function scopePipeline<T extends { targetQuarterPlanId: string | null; createdAt: string }>(rows: T[], scope: PlanScope): T[] {
  if (scope.mode === "all") return rows;
  return rows.filter((p) => p.targetQuarterPlanId === scope.plan.id || inScope(scope, p.createdAt));
}

// Case studies: proposed during the quarter, or used in coverage that ran in it.
export function scopeCaseStudies<T extends { createdAt: string; usedIn: Array<{ publishDate: string | null }> }>(rows: T[], scope: PlanScope): T[] {
  if (scope.mode === "all") return rows;
  return rows.filter((c) => inScope(scope, c.createdAt) || c.usedIn.some((u) => inScope(scope, u.publishDate)));
}

// Work Board cards: anything that was live during the quarter. A card counts
// if it was created before the quarter ended and is still open, or was
// created or due inside the quarter. Carry-overs therefore show in every
// quarter they were worked.
export function cardInScope(scope: PlanScope, c: { createdAt: string; dueDate: string | null; done: boolean }): boolean {
  if (scope.mode === "all") return true;
  const { starts_on, ends_on } = scope.plan;
  const created = c.createdAt.slice(0, 10);
  if (created > ends_on) return false;
  if (!c.done) return true;
  return created >= starts_on || inScope(scope, c.dueDate);
}

export function scopeCards<T extends { createdAt: string; dueDate: string | null; done: boolean }>(cards: T[], scope: PlanScope): T[] {
  return cards.filter((c) => cardInScope(scope, c));
}

export const AWARD_IN_FLIGHT = new Set(["agreed", "submitted", "shortlisted"]);
