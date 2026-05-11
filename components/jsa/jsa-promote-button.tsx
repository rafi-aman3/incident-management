"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ListPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promoteStepHazard } from "@/lib/actions/jsa";

export function JsaPromoteButton({ stepHazardId }: { stepHazardId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function onClick() {
    startTransition(async () => {
      const result = await promoteStepHazard(stepHazardId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Step hazard promoted to register queue");
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return <span className="text-xs text-muted-foreground">Promoted — review in candidate queue</span>;
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={pending}>
      <ListPlus className="mr-1 h-3 w-3" />
      {pending ? "Promoting…" : "Promote to register"}
    </Button>
  );
}
