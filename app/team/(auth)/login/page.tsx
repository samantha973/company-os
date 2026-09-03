import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { BRAND_TEAM } from "@/lib/brand";

export default function TeamLoginPage() {
  return (
    <main className="admin-auth">
      <div className="admin-auth-card">
        <div className="admin-auth-brand">
          {BRAND_TEAM}
        </div>
        <p className="admin-auth-sub">Sign in to your team workspace.</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
