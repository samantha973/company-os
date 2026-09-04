import { Badge, statusTone } from "@/components/admin/Badge";
import type { PortalInvoice } from "@/lib/portal/invoices";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";

// The client's invoices: header line, outstanding balance with a pay link,
// and line items on demand. Renders lib/portal/invoices.ts's restricted
// column list only — `memo` is never selected, so nothing can leak here.
export function PortalInvoices({ invoices }: { invoices: PortalInvoice[] }) {
  const openTotal = invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);
  if (invoices.length === 0) return <div className="admin-empty">No invoices yet.</div>;
  return (
    <div className="admin-panel">
      <p className="admin-page-sub u-m-0">{openTotal > 0 ? `${formatCents(openTotal, invoices[0].currency)} outstanding` : "You're all paid up."}</p>
      {invoices.map((inv) => (
        <div className="admin-box admin-box--pad" key={inv.id}>
          <div className="u-row u-between u-wrap">
            <div>
              <h3 className="admin-card-title u-mb-1">Invoice {inv.docNumber || inv.id.slice(0, 8)}</h3>
              <div className="admin-cell-muted">
                {formatDate(inv.txnDate)}
                {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""}
              </div>
            </div>
            <div className="u-right">
              <div className="admin-cell-mono u-xl">{formatCents(inv.amountCents, inv.currency)}</div>
              <Badge tone={statusTone(inv.status)}>{humanize(inv.status)}</Badge>
            </div>
          </div>
          {inv.balanceCents > 0 && (
            <p className="admin-page-sub u-mt-2">
              {formatCents(inv.balanceCents, inv.currency)} outstanding
              {inv.paymentLink && (
                <>
                  {" · "}
                  <a href={inv.paymentLink} target="_blank" rel="noreferrer">Pay now</a>
                </>
              )}
            </p>
          )}
          {inv.lines.length > 0 && (
            <details className="u-mt-3">
              <summary className="admin-cell-muted u-pointer">Line items ({inv.lines.length})</summary>
              <div className="admin-table-wrap admin-table-wrap--flat u-mt-2">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th className="u-right">Qty</th>
                      <th className="u-right">Rate</th>
                      <th className="u-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inv.lines.map((line, i) => (
                      <tr key={i}>
                        <td>{line.description || line.item_name || "—"}</td>
                        <td className="u-right">{line.quantity}</td>
                        <td className="admin-cell-mono u-right">{formatCents(Math.round(line.rate * 100), inv.currency)}</td>
                        <td className="admin-cell-mono u-right">{formatCents(Math.round(line.amount * 100), inv.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}
