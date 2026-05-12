import { createClient } from "@/lib/supabase/server";
import { getMyDrafts } from "@/lib/dashboard/org/my-drafts";
import { getRecentAssets } from "@/lib/dashboard/org/recent-assets";
import { getRecentDocuments } from "@/lib/dashboard/org/recent-documents";
import { MyDraftsCard } from "./my-drafts-card";
import { RecentAssetsCard } from "./recent-assets-card";
import { RecentDocumentsCard } from "./recent-documents-card";

export async function BottomRow({
  orgId,
  siteId,
  userId,
}: {
  orgId: string;
  siteId: string | null;
  userId: string;
}) {
  const supabase = await createClient();
  const [drafts, assets, documents] = await Promise.all([
    getMyDrafts(supabase, userId, orgId, siteId),
    getRecentAssets(supabase, orgId, siteId),
    getRecentDocuments(supabase, orgId, siteId),
  ]);
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      <MyDraftsCard rows={drafts} />
      <RecentAssetsCard rows={assets} />
      <RecentDocumentsCard rows={documents} />
    </div>
  );
}
