"use server";

import { cookies } from "next/headers";
import { SELECTED_SITE_COOKIE } from "@/lib/supabase/auth";

export async function setSelectedSite(siteId: string) {
  const store = await cookies();
  store.set(SELECTED_SITE_COOKIE, siteId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
