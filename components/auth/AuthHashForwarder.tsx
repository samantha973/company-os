"use client";

import { useEffect } from "react";

// Supabase's invite / password-recovery / magic-link emails can land on the
// Site URL (this page) with the session in the URL fragment
// (#access_token=…&type=recovery) instead of the redirect the app asked for.
// The marketing home ignores fragments, so the person just sees the homepage
// and cannot set a password. Forward the fragment, untouched, to the page that
// knows how to redeem it. Nothing is read or stored here.
export function AuthHashForwarder() {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) return;
    const type = new URLSearchParams(hash.replace(/^#/, "")).get("type");
    const target = type === "recovery" || type === "invite" ? "/admin/reset-password" : "/admin";
    window.location.replace(`${target}${hash}`);
  }, []);
  return null;
}
