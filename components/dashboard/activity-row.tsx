import { createClient } from "@/lib/supabase/server";
import { getRecentActivity } from "@/lib/dashboard/org/recent-activity";
import { RecentActivityCard } from "./recent-activity-card";
import { LatestBulletinsCard } from "./latest-bulletins-card";

export async function ActivityRow({
  orgId,
  siteId,
}: {
  orgId: string;
  siteId: string | null;
}) {
  const supabase = await createClient();
  const rows = await getRecentActivity(supabase, orgId, siteId);
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <RecentActivityCard rows={rows} />
      <LatestBulletinsCard />
    </div>
  );
}
