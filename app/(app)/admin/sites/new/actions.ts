"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SELECTED_SITE_COOKIE } from "@/lib/supabase/auth";

export type CreateSiteState =
  | null
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

const Schema = z.object({
  name: z.string().trim().min(1, "Site name is required").max(120),
  country: z.enum(["US", "GB"]),
  timezone: z.string().trim().min(1, "Time zone is required").max(80),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  naics_code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "NAICS must be exactly 6 digits")
    .optional()
    .or(z.literal("")),
  parent_site_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createSite(
  _prev: CreateSiteState,
  fd: FormData,
): Promise<CreateSiteState> {
  const parsed = Schema.safeParse({
    name: fd.get("name"),
    country: fd.get("country"),
    timezone: fd.get("timezone"),
    address: fd.get("address") ?? "",
    naics_code: fd.get("naics_code") ?? "",
    parent_site_id: fd.get("parent_site_id") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path.join(".") || "_";
      (fieldErrors[path] ??= []).push(issue.message);
    }
    return { ok: false, error: "Validation failed", fieldErrors };
  }

  const supabase = await createClient();
  const { data: siteId, error } = await supabase.rpc("create_site_v1", {
    p_name: parsed.data.name,
    p_country: parsed.data.country,
    p_timezone: parsed.data.timezone,
    p_address: parsed.data.address || undefined,
    p_naics_code: parsed.data.naics_code || undefined,
    p_parent_site_id: parsed.data.parent_site_id || undefined,
  });

  if (error || !siteId) {
    return { ok: false, error: error?.message ?? "Failed to create site" };
  }

  const store = await cookies();
  store.set(SELECTED_SITE_COOKIE, siteId, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/admin/site-setup");
}
