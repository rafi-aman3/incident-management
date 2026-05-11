"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgPermission } from "@/lib/auth/orgCan";
import { requireUser } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";
import { getItemById } from "@/lib/get-started/items";
import { USE_CASE_KEYS, type UseCaseKey } from "@/lib/get-started/use-cases";

async function loadOrgArray(
  column: "onboarding_use_cases" | "onboarding_dismissed",
  orgId: string
): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orgs")
    .select(column)
    .eq("id", orgId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Org not found");
  return ((data as Record<string, string[] | null>)[column] ?? []) as string[];
}

export async function dismissItem(itemId: string): Promise<ActionResult> {
  await requireOrgPermission("org:configure");
  if (!getItemById(itemId)) return { ok: false, error: "Unknown item" };

  const { profile } = await requireUser();
  const current = await loadOrgArray("onboarding_dismissed", profile.org_id);
  if (current.includes(itemId)) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({ onboarding_dismissed: [...current, itemId] })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/get-started");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function undismissItem(itemId: string): Promise<ActionResult> {
  await requireOrgPermission("org:configure");
  if (!getItemById(itemId)) return { ok: false, error: "Unknown item" };

  const { profile } = await requireUser();
  const current = await loadOrgArray("onboarding_dismissed", profile.org_id);
  if (!current.includes(itemId)) {
    return { ok: true };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({ onboarding_dismissed: current.filter((id) => id !== itemId) })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/get-started");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true };
}

const updateUseCasesSchema = z.object({
  use_cases: z
    .array(z.enum(USE_CASE_KEYS as unknown as [UseCaseKey, ...UseCaseKey[]]))
    .max(USE_CASE_KEYS.length),
});

export async function updateUseCases(useCases: UseCaseKey[]): Promise<ActionResult> {
  await requireOrgPermission("org:configure");
  const parsed = updateUseCasesSchema.safeParse({ use_cases: useCases });
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  const { profile } = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("orgs")
    .update({ onboarding_use_cases: parsed.data.use_cases })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/get-started");
  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
  return { ok: true };
}
