import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { ProfileCard } from "@/components/settings/profile-card";
import { SecurityCard } from "@/components/settings/security-card";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { SignOutCard } from "@/components/settings/sign-out-card";

export default async function SettingsPage() {
  const { profile, user } = await requireUser();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account preferences for this user. Org-level settings (sites,
          members, roles, invitations) live under{" "}
          <Link
            href="/admin"
            className="font-medium text-brand underline underline-offset-2 hover:no-underline"
          >
            Admin
          </Link>
          .
        </p>
      </div>

      <ProfileCard
        initial={{
          full_name: profile.full_name,
          email: user.email ?? profile.email,
          department: profile.department,
        }}
      />
      <SecurityCard />
      <AppearanceCard />
      <SignOutCard />
    </div>
  );
}
