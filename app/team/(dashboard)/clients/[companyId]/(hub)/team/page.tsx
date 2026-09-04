import { redirect } from "next/navigation";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

// Folded into the client hub (one tabbed page). Kept so old links still land.
export default function Redirect({ params, searchParams }: { params: { companyId: string }; searchParams: SearchParamsObj }) {
  const plan = firstParam(searchParams.plan);
  const kind = firstParam(searchParams.kind);
  redirect(`/team/clients/${params.companyId}?tab=team${plan ? `&plan=${encodeURIComponent(plan)}` : ""}${kind ? `&kind=${encodeURIComponent(kind)}` : ""}`);
}
