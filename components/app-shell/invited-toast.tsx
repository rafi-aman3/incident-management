"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * Fires a single Sonner success toast when the URL contains `?invited=<site>`,
 * then strips the param. Mounted on the dashboard — the accept-invitation
 * action redirects here on success with the joined site name.
 */
export function InvitedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    const invited = params.get("invited");
    if (!invited || fired.current) return;
    fired.current = true;

    toast.success(`Welcome to ${invited}`, {
      description: "You're now a member. Switch sites from the topbar any time.",
    });

    const next = new URLSearchParams(params);
    next.delete("invited");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname, router]);

  return null;
}
