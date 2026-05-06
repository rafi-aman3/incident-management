import { Separator } from "@/components/ui/separator";
import { SiteSwitcher, type SwitcherSite } from "./site-switcher";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { HelpDrawer } from "./help-drawer";
import { UserMenu } from "./user-menu";
import { SearchTrigger } from "./search-trigger";
import { MobileMenuButton } from "./mobile-menu-button";
import type { RoleKey } from "@/lib/supabase/auth";

export function Topbar({
  sites,
  currentSiteId,
  canCreateSite,
  notifications,
  fullName,
  email,
  roleLabel,
  currentSiteName,
  roleKey,
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
  notifications: NotificationItem[];
  fullName: string;
  email: string;
  roleLabel: string;
  currentSiteName: string | null;
  roleKey: RoleKey;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Hamburger: only shown below lg, where the shadcn sidebar primitive is
          in Sheet mode. Above lg, the 6k pin/hover-drawer rail handles toggling. */}
      <MobileMenuButton className="-ml-1 lg:hidden" />
      <Separator orientation="vertical" className="mx-1 h-5 lg:hidden" />
      <SiteSwitcher sites={sites} currentSiteId={currentSiteId} canCreateSite={canCreateSite} />
      <div className="mx-auto hidden flex-1 justify-center px-4 md:flex">
        <SearchTrigger variant="input" />
      </div>
      <div className="ml-auto flex items-center gap-1 md:ml-0">
        <div className="md:hidden">
          <SearchTrigger variant="icon" />
        </div>
        <HelpDrawer roleKey={roleKey} />
        <NotificationBell notifications={notifications} />
        <UserMenu
          fullName={fullName}
          email={email}
          roleLabel={roleLabel}
          siteName={currentSiteName}
        />
      </div>
    </header>
  );
}
