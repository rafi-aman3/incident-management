"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

// Hamburger that opens the sidebar's Sheet at < lg. Wraps shadcn's
// useSidebar() context (same hook the primitive's SidebarTrigger uses)
// so we get the correct mobile vs. desktop toggle semantics for free,
// without editing the shadcn primitive.
export function MobileMenuButton({ className }: { className?: string }) {
  const { toggleSidebar } = useSidebar();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={toggleSidebar}
      aria-label="Open menu"
      className={className}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
