import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientCoverageForActor } from "@/lib/team/clients";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Coverage" };

function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatReach(n: number | null): string {
  if (n == null) return "";
  return n.toLocaleString("en-GB");
}

const CHANNEL_LABEL: Record<string, string> = {
  earned: "Earned",
  online: "Online",
  syndication: "Syndication",
  podcast: "Podcast",
  speaking: "Speaking",
  linkedin: "LinkedIn",
  blog: "Blog",
  email: "Email",
  facebook: "Facebook",
  other: "Other",
};

// The Coverage tab: this client's secured media coverage, read from
// marketing_content. Read-only for v1 (seeded from the account sheet); the
// portal-facing coverage view is deferred until it has been seen internally.
export default async function TeamClientCoverageTab({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const coverage = await getClientCoverageForActor(actor, params.companyId);
  if (coverage === null) notFound();

  return (
    <section className="admin-card admin-section-card">
      <h2 className="admin-card-title" style={{ marginBottom: 10 }}>
        Media coverage{coverage.length > 0 && ` · ${coverage.length}`}
      </h2>
      {coverage.length === 0 ? (
        <div className="admin-empty">No coverage recorded yet.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Outlet</th>
                <th>Headline</th>
                <th>Format</th>
                <th style={{ textAlign: "right" }}>Reach</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((c) => (
                <tr key={c.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{formatDay(c.date)}</td>
                  <td>{c.outlet}</td>
                  <td>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer">{c.headline}</a>
                    ) : (
                      c.headline
                    )}
                  </td>
                  <td>{CHANNEL_LABEL[c.channel] ?? c.channel}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{formatReach(c.reach)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
