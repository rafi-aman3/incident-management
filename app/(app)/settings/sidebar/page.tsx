import { requireUser } from "@/lib/supabase/auth";
import { HIDEABLE_NAV_ITEMS } from "@/components/app-shell/nav-config";
import {
  SidebarPrefCard,
  type HideableItem,
} from "@/components/settings/sidebar-pref-card";

export default async function SettingsSidebarPage() {
  const { profile } = await requireUser();

  const hideable: HideableItem[] = HIDEABLE_NAV_ITEMS.map((it) => ({
    href: it.href,
    label: it.label,
    icon: it.icon,
  }));

  return (
    <SidebarPrefCard
      hideable={hideable}
      initialHidden={profile.sidebar_hidden_items ?? []}
    />
  );
}
