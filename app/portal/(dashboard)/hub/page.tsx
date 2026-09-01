import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { contributorCompanyScope } from "@/lib/portal/roles";
import { listPortalProgramSummaries } from "@/lib/portal/program-hub";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = { title: "PR Programs" };

// The PR Programs hub: the PR Program cards for the actor's companies. One list
// for the whole portal (/portal/programs redirects here).
export default async function PortalHubPage() {
  const actor = await requirePortalMember();
  const programs = await listPortalProgramSummaries(actor);
  // Creating programs is contributor+ (viewers browse only), same gate as the
  // former PR Programs list page.
  const canCreate = contributorCompanyScope(actor).length > 0;

  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Client Portal"
        title="PR Programs"
        sub="Your PR Programs with Edge8."
        action={
          canCreate ? (
            <Link href="/portal/programs/add" className="admin-btn admin-btn--primary">
              Add PR Program
            </Link>
          ) : undefined
        }
      />

      {programs.length === 0 ? (
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title" style={{ marginBottom: 8 }}>No PR Programs yet</h2>
          <p className="admin-page-sub" style={{ margin: 0 }}>
            This is where you plan and track PR programs with Edge8. Start one from a guided plan or by
            uploading your own documents.
          </p>
          {canCreate && (
            <div style={{ marginTop: 16 }}>
              <Link href="/portal/programs/add" className="admin-btn admin-btn--primary">
                Add PR Program
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="admin-card admin-section-card">
          <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Your programs</h2>
          <div className="admin-list">
            {programs.map((p) => {
              const meta =
                p.roadmapTotal > 0 ? `Roadmap ${p.roadmapDone}/${p.roadmapTotal} done` : "No roadmap items yet";
              return (
                <Link
                  key={p.id}
                  href={`/portal/programs/${p.id}`}
                  className="admin-list-row"
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="admin-list-main">
                    <div className="admin-list-title">{p.name}</div>
                    {p.description && <div className="admin-list-sub">{p.description}</div>}
                    <div className="admin-list-sub">{meta}</div>
                  </div>
                  <div className="admin-list-aside">
                    <Badge tone={statusTone(p.status)}>{humanize(p.status)}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
