import { requireUser } from "@/lib/supabase/auth";
import { NotificationsPrefsCard } from "@/components/settings/notifications-prefs-card";

export default async function SettingsNotificationsPage() {
  const { supabase, profile } = await requireUser();

  const { data: rows } = await supabase
    .from("user_notification_silences")
    .select("notification_kind")
    .eq("profile_id", profile.id);

  const silenced = (rows ?? []).map((r) => r.notification_kind as string);

  return <NotificationsPrefsCard initialSilenced={silenced} />;
}
