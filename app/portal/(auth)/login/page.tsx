import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { BRAND_PORTAL, BRAND_SHORT } from "@/lib/brand";

export default function PortalLoginPage() {
  return (
    <main className="admin-auth">
      <div className="admin-auth-card">
        <div className="admin-auth-brand">
          {BRAND_PORTAL}
        </div>
        <p className="admin-auth-sub">Sign in to your {BRAND_SHORT} client hub.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
