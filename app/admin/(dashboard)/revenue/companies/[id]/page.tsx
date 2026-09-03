import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCompany360, getCompanyReferredBy } from "@/lib/admin/companies";
import { getPortalMembershipsForCompany } from "@/lib/admin/portal";
import {
  getAssignmentsForCompany,
  listActiveTeamMembers,
  listClientContacts,
} from "@/lib/admin/staff-assignments";
import { getSurveyResponsesForCompany } from "@/lib/admin/surveys";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { Tabs, type TabDef } from "@/components/admin/Tabs";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import { PortalMemberControls } from "@/components/admin/PortalMemberControls";
import { CrmCommandBar } from "@/components/admin/CrmCommandBar";
import { AssignedStaffCard } from "@/components/admin/AssignedStaffCard";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { CompanyDetailsCard } from "../CompanyDetailsCard";
import { CompanyDangerZone } from "../CompanyDangerZone";

export const dynamic = "force-dynamic";

const CLIENT_STAGES = new Set(["customer", "evangelist"]);

function Empty({ text }: { text: string }) {
  return <div className="admin-empty">{text}</div>;
}

// The company's CRM record: details, portal access, staffing, surveys. The
// client's PR work lives on its own page, the Client Hub (/admin/clients/[id]).
export default async function CompanyDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: SearchParamsObj;
}) {
  // Old deep links to the hub view of this page land on the Client Hub.
  if (firstParam(searchParams.view) === "hub") redirect(`/admin/clients/${params.id}`);

  const data = await getCompany360(params.id);
  if (!data) notFound();

  const { company, deals, people, affiliate: companyAffiliate } = data;
  const name = company.name || "(no name)";
  const isClient = CLIENT_STAGES.has((company.lifecycle_stage || "").toLowerCase());

  // Context-aware back-link: reflect where the user came from (Clients or the
  // Companies list) rather than always "Companies".
  const from = firstParam(searchParams.from);
  const back =
    from === "clients"
      ? { href: "/admin/revenue/clients", label: "← Clients" }
      : { href: "/admin/revenue/companies", label: "← Companies" };

  const dealValueCents = deals.reduce((s, d) => s + (d.amount_usd_cents ?? d.amount_cents ?? 0), 0);
  const affiliateContacts = people.filter((p) => p.affiliateActive);
  const showAffiliateCard = !!companyAffiliate?.active || affiliateContacts.length > 0;

  const [portalMemberships, assignments, assignableTeamMembers, clientContacts, referredBy, surveys] =
    await Promise.all([
      getPortalMembershipsForCompany(company.id),
      getAssignmentsForCompany(company.id),
      listActiveTeamMembers(),
      listClientContacts(company.id),
      getCompanyReferredBy(company.id),
      getSurveyResponsesForCompany(company.id),
    ]);
  const activeMemberCount = [...portalMemberships.values()].filter((m) => m.status === "active").length;

  const tabs: TabDef[] = [
    {
      key: "details",
      label: "Details",
      content: (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CompanyDetailsCard
            company={{
              id: company.id,
              name: company.name,
              website_url: company.website_url,
              industry_normalized: company.industry_normalized,
              size_band: company.size_band,
              country: company.country,
              priority: company.priority,
              notes: company.notes,
              created_at: company.created_at,
            }}
            referredBy={referredBy}
          />
          {showAffiliateCard && (
            <div className="admin-card admin-section-card">
              <h2 className="admin-card-title">Referral &amp; affiliates</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {companyAffiliate?.active && (
                  <div>
                    <div className="admin-cell-muted" style={{ fontSize: 12, marginBottom: 4 }}>This company is an affiliate</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      {companyAffiliate.code && <Badge tone="ok">{companyAffiliate.code}</Badge>}
                      <span className="admin-cell-strong">{formatCents(companyAffiliate.realizedCents, "usd")} earned</span>
                      {companyAffiliate.unpaidCents > 0 && (
                        <span className="admin-cell-muted">· {formatCents(companyAffiliate.unpaidCents, "usd")} unpaid</span>
                      )}
                    </div>
                  </div>
                )}
                {affiliateContacts.length > 0 && (
                  <div>
                    <div className="admin-cell-muted" style={{ fontSize: 12, marginBottom: 4 }}>Affiliate contacts</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {affiliateContacts.map((p) => (
                        <Link key={p.id} href={`/admin/contacts/${p.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {p.full_name || p.email}
                          {p.affiliateCode && <Badge tone="ok">{p.affiliateCode}</Badge>}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="admin-card admin-section-card">
            <CompanyDangerZone companyId={company.id} companyName={name} />
          </div>
        </div>
      ),
    },
    {
      key: "people",
      label: "People & access",
      count: activeMemberCount,
      content:
        people.length === 0 ? (
          <Empty text="No linked people yet. Link a contact from the CRM to invite them to the portal." />
        ) : (
          <div className="admin-list">
            {people.map((p) => {
              const membership = portalMemberships.get(p.id);
              return (
                <div className="admin-list-row" key={p.id}>
                  <div className="admin-list-main">
                    <div className="admin-list-title">
                      <Link href={`/admin/contacts/${p.id}`}>{p.full_name || p.email}</Link>
                    </div>
                    <div className="admin-list-sub">{p.email}</div>
                  </div>
                  <div className="admin-list-aside">
                    <PortalMemberControls
                      personId={p.id}
                      companyId={company.id}
                      active={membership?.status === "active"}
                      role={membership?.role}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ),
    },
    {
      key: "staffing",
      label: "Staffing",
      count: assignments.length,
      content: (
        <AssignedStaffCard
          companyId={company.id}
          assignments={assignments}
          teamMembers={assignableTeamMembers}
          clientContacts={clientContacts}
        />
      ),
    },
    {
      key: "surveys",
      label: "Surveys",
      count: surveys.length,
      content:
        surveys.length === 0 ? (
          <Empty text="No survey responses from this company's people yet." />
        ) : (
          <div className="admin-list">
            {surveys.map((s) => (
              <div className="admin-list-row" key={s.id}>
                <div className="admin-list-main">
                  <div className="admin-list-title">{s.surveyName}</div>
                  <div className="admin-list-sub">{s.respondentName}</div>
                </div>
                <div className="admin-list-aside">
                  <Badge tone="neutral">{formatDate(s.submittedAt)}</Badge>
                </div>
              </div>
            ))}
          </div>
        ),
    },
  ];

  return (
    <div>
      <PageHead
        eyebrow={<Link href={back.href}>{back.label}</Link>}
        title={name}
        sub={company.website_url || undefined}
        action={
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
            <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              {company.archived_at && <Badge tone="neutral">Archived</Badge>}
              {isClient ? <Badge tone="ok">Client</Badge> : company.lifecycle_stage && <Badge tone="neutral">{humanize(company.lifecycle_stage)}</Badge>}
              {company.priority && <Badge>{humanize(company.priority)}</Badge>}
            </span>
            <CrmCommandBar
              kind="company"
              id={company.id}
              name={name}
              archived={!!company.archived_at}
              assumeCompanyId={company.id}
              affiliate={{ active: !!companyAffiliate?.active, code: companyAffiliate?.code ?? null }}
            />
          </div>
        }
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Link href={`/admin/clients/${company.id}`} className="admin-btn admin-btn--primary">
          Open Client Hub →
        </Link>
        <span className="admin-cell-muted" style={{ fontSize: 13 }}>
          {deals.length} {deals.length === 1 ? "deal" : "deals"}
          {dealValueCents ? ` · ${formatCents(dealValueCents, "usd")} total` : ""} ·{" "}
          <Link href={`/admin/revenue/deals?company=${company.id}`}>Open in CRM →</Link>
        </span>
      </div>

      <div className="admin-card admin-section-card">
        <Tabs tabs={tabs} initialKey={firstParam(searchParams.tab)} syncParam="tab" />
      </div>
    </div>
  );
}
