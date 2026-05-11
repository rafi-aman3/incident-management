import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { EmptyState } from "@/components/empty-state";
import { SdsIntegrationCard } from "@/components/admin/sds-integration-card";

export default async function IntegrationsPage() {
  const { currentSiteId } = await requireUser();
  if (!currentSiteId || !(await can("site:configure", currentSiteId))) {
    return (
      <EmptyState
        title="Integrations need site:configure"
        body="Ask a site admin for permission to manage external integrations."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to admin
      </Link>

      <header>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect external systems to your EHS data. Each card lists what the integration does and how to import or export.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SdsIntegrationCard />
        {/* Future: Training providers, HSE/OSHA APIs, BI exports */}
      </div>
    </div>
  );
}
