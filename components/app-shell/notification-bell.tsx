import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotificationBell({ count }: { count: number }) {
  return (
    <Button variant="ghost" size="icon" aria-label="Notifications" className="relative h-8 w-8">
      <Bell className="h-4 w-4" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
          {count}
        </span>
      ) : null}
    </Button>
  );
}
