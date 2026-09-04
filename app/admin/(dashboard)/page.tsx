import { redirect } from "next/navigation";

// The Client Hubs list is the admin home screen. The company dashboard
// still lives at /admin/dashboard, unlinked from the nav for now.
export default function AdminHome() {
  redirect("/admin/client-hubs");
}
