// Quarter arithmetic for 90-day plans. Client-safe. Financial year runs
// July–June (Australian), so Q1 FY27 = Jul–Sep 2026.

export type QuarterSpec = { label: string; startsOn: string; endsOn: string };

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// The quarter containing `date`.
export function quarterFor(date: Date): QuarterSpec {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0-11
  const qStartMonth = Math.floor(m / 3) * 3; // 0,3,6,9
  const start = new Date(Date.UTC(y, qStartMonth, 1));
  const end = new Date(Date.UTC(y, qStartMonth + 3, 0));
  // FY quarter: Jul=Q1, Oct=Q2, Jan=Q3, Apr=Q4; FY named by the June it ends in.
  const fyQuarter = ((qStartMonth - 6 + 12) % 12) / 3 + 1;
  const fyYear = qStartMonth >= 6 ? y + 1 : y;
  return { label: `Q${fyQuarter} FY${String(fyYear).slice(-2)}`, startsOn: iso(start), endsOn: iso(end) };
}

// The quarter after the one ending on `endsOn` (a YYYY-MM-DD date).
export function quarterAfter(endsOn: string): QuarterSpec {
  const end = new Date(`${endsOn}T00:00:00Z`);
  const next = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1));
  return quarterFor(next);
}

// What to offer as the next plan: the quarter after the latest plan, or the
// current quarter when nothing is planned yet.
export function suggestNextQuarter(latestEndsOn: string | null, today = new Date()): QuarterSpec {
  return latestEndsOn ? quarterAfter(latestEndsOn) : quarterFor(today);
}
