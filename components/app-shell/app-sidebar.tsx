"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ShieldCheck } from "lucide-react";
import { NAV_ITEMS } from "./nav-config";

export function AppSidebar({
  allowedHrefs,
  userLabel,
  roleLabel,
}: {
  allowedHrefs: ReadonlyArray<string>;
  userLabel: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const allowed = new Set(allowedHrefs);
  const items = NAV_ITEMS.filter((item) => allowed.has(item.href));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
            E
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">EHS Platform</span>
            <span className="text-xs text-muted-foreground">v1.0</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3 group-data-[collapsible=icon]:hidden">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          <div className="flex flex-col leading-tight">
            <span className="font-medium text-foreground">{userLabel}</span>
            <span>{roleLabel}</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
