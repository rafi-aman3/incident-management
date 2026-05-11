import { requireUser } from "@/lib/supabase/auth";
import { ProfileCard } from "@/components/settings/profile-card";

export default async function SettingsProfilePage() {
  const { profile, user } = await requireUser();
  return (
    <ProfileCard
      initial={{
        full_name: profile.full_name,
        email: user.email ?? profile.email,
        department: profile.department,
      }}
    />
  );
}
