import { redirect } from "next/navigation";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";

// The program workspace is The Hub now; its tabs map one-to-one.
export default function Redirect({ searchParams }: { searchParams: SearchParamsObj }) {
  const tab = firstParam(searchParams.tab);
  const map: Record<string, string> = { board: "board", documents: "documents", meetings: "meetings", overview: "plan" };
  redirect(`/portal?tab=${map[tab ?? ""] ?? "board"}`);
}
