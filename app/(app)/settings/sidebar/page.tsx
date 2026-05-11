import { requireUser } from "@/lib/supabase/auth";
import { SidebarPrefCard } from "@/components/settings/sidebar-pref-card";

export default async function SettingsSidebarPage() {
  const { profile } = await requireUser();
  return <SidebarPrefCard initialHidden={profile.sidebar_hidden_items ?? []} />;
}
