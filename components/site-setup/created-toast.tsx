"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * Fires a single Sonner success toast when the URL contains `?created=<name>`,
 * then strips the param from the URL so a refresh doesn't replay it. Mounted
 * once on the site-setup landing — the create-site action redirects here with
 * the new site name encoded.
 */
export function SiteCreatedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    const created = params.get("created");
    if (!created || fired.current) return;
    fired.current = true;

    toast.success(`${created} created`, {
      description: "You're now site admin. Finish setup or come back later.",
    });

    const next = new URLSearchParams(params);
    next.delete("created");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [params, pathname, router]);

  return null;
}
