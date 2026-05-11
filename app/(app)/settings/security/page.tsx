import { SecurityCard } from "@/components/settings/security-card";
import { SignOutSection } from "@/components/settings/sign-out-section";

export default function SettingsSecurityPage() {
  return (
    <div className="space-y-4">
      <SecurityCard />
      <SignOutSection />
    </div>
  );
}
