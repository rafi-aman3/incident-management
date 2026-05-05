import { ReactNode, Suspense } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-shell/app-sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { navItemsForRole, ROLE_BADGE } from "@/components/app-shell/nav-config";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/supabase/auth";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

async function AppShell({ children }: { children: ReactNode }) {
  const { profile, memberships, currentMembership, currentSiteId, currentRoleKey, supabase } =
    await requireUser();

  const items = navItemsForRole(currentRoleKey);
  const sites = memberships
    .map((m) =>
      m.site
        ? { id: m.site.id, name: m.site.name, country: m.site.country }
        : null
    )
    .filter((s): s is { id: string; name: string; country: "US" | "GB" } => s !== null);

  let notificationCount = 0;
  if (currentSiteId) {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("site_id", currentSiteId)
      .is("resolved_at", null);
    notificationCount = count ?? 0;
  }

  const fullName = profile.full_name ?? profile.email;
  const roleLabel = ROLE_BADGE[currentRoleKey].label;

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar items={items} userLabel={fullName} roleLabel={roleLabel} />
      <SidebarInset>
        <Topbar
          sites={sites}
          currentSiteId={currentSiteId}
          notificationCount={notificationCount}
          fullName={fullName}
          email={profile.email}
          roleLabel={roleLabel}
          currentSiteName={currentMembership?.site?.name ?? null}
        />
        <main className="flex-1 px-6 py-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppShellFallback() {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar p-4 md:block">
        <Skeleton className="mb-6 h-8 w-32" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-4">
          <Skeleton className="h-6 w-40" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </header>
        <main className="flex-1 px-6 py-6">
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    </div>
  );
}
