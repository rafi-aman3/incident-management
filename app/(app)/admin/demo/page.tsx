import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  EnableDemoButton,
  TriggerBannerButton,
  LoadSampleChainButton,
  ResetDataButton,
} from "@/components/admin/demo-buttons";

export default async function DemoAffordancesPage() {
  const { supabase, profile, currentSiteId } = await requireUser();

  const canReset = currentSiteId ? await can("demo:reset", currentSiteId) : false;
  if (!canReset) redirect("/dashboard");

  const { data: org } = await supabase
    .from("orgs")
    .select("name, is_demo")
    .eq("id", profile.org_id)
    .single();

  const isDemo = !!org?.is_demo;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Admin
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Demo affordances</h1>
        <p className="text-sm text-muted-foreground">
          Stakeholder-friendly buttons for reset / sample-load / banner-trigger.
          Visible only to site admins; destructive actions guarded by the org&apos;s
          <span className="font-mono"> is_demo </span> flag.
        </p>
      </div>

      {!isDemo && (
        <div className="rounded-md border-l-4 border-warning bg-warning/5 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
            <div>
              <p className="text-sm font-semibold">
                {org?.name ?? "This org"} is not flagged as a demo org
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The destructive RPCs will refuse until you opt in. Flip the flag
                only on a stakeholder-demo org — never on real production data.
              </p>
              <div className="mt-3">
                <EnableDemoButton />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card
          title="Trigger banner"
          body="Inserts a fake OSHA 8-hour notification with a 1-hour deadline. Visible to you only — perfect for a screencap."
        >
          <TriggerBannerButton />
        </Card>

        <Card
          title="Load sample CAPA chain"
          body="Creates a Track A injury → closed investigation → CAPA in pending verification, with a different verifier so you can demo the verification form in 30 seconds."
        >
          <LoadSampleChainButton />
        </Card>

        <Card
          title="Reset demo data"
          body="Wipes all transactional rows back to seed state. Sites, members, and roles are preserved. Re-run pnpm db:seed afterwards."
          destructive
        >
          <ResetDataButton />
        </Card>
      </div>

      <div className="rounded-md border bg-muted/30 p-4 text-xs text-muted-foreground">
        Behind the scenes: each button calls an RPC defined in the Phase 2
        migration set —
        <span className="font-mono"> reset_demo_data_v1</span>,
        <span className="font-mono"> load_sample_chain_v1</span>,
        plus a direct insert for the banner. All three guard on
        <span className="font-mono"> orgs.is_demo</span> so a real prod admin
        clicking through this page can&apos;t hurt anything.
      </div>
    </div>
  );
}

function Card({
  title,
  body,
  destructive,
  children,
}: {
  title: string;
  body: string;
  destructive?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border p-4 ${
        destructive ? "border-destructive/40 bg-destructive/5" : "bg-card"
      }`}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="flex-1 text-xs text-muted-foreground">{body}</p>
      {children}
    </div>
  );
}
