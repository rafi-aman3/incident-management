import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { SiteSwitcher, type SwitcherSite } from "./site-switcher";
import { NotificationBell, type NotificationItem } from "./notification-bell";
import { UserMenu } from "./user-menu";

export function Topbar({
  sites,
  currentSiteId,
  notifications,
  fullName,
  email,
  roleLabel,
  currentSiteName,
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  notifications: NotificationItem[];
  fullName: string;
  email: string;
  roleLabel: string;
  currentSiteName: string | null;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1 h-5" />
      <SiteSwitcher sites={sites} currentSiteId={currentSiteId} />
      <div className="ml-auto flex items-center gap-1">
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
