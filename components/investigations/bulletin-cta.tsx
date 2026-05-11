import Link from "next/link";
import { Megaphone, ArrowRight } from "lucide-react";

/**
 * Post-investigation prompt that surfaces on the Summary tab of a closed
 * Track-A investigation, gated on `bulletin:create`. Renders one of two
 * states:
 *
 *   - no existing bulletin → "Draft a Safety Bulletin from this
 *     investigation" CTA, links to /bulletins/new?from_investigation={id}
 *     where the composer page pre-fills title + body from findings.
 *   - existing bulletin    → "Bulletin drafted: {title}" link card.
 *
 * The gate (closed && track === 'A' && permission && existing-check) is
 * computed server-side in the page; this component just renders the
 * matching state. Pass either `existing` xor `investigationId`.
 */
export function BulletinCta(
  props:
    | { investigationId: string; existing?: undefined }
    | { existing: { id: string; title: string }; investigationId?: undefined },
) {
  if (props.existing) {
    return (
      <Link
        href={`/bulletins/${props.existing.id}`}
        className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 transition hover:border-primary/40"
      >
        <Megaphone className="size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Bulletin drafted</div>
          <div className="truncate text-xs text-muted-foreground">
            {props.existing.title}
          </div>
        </div>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <Megaphone className="size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">
          Share what you learned
        </div>
        <p className="text-xs text-muted-foreground">
          Track-A investigation closed. Draft a Safety Bulletin so every
          worker hears the lessons — pre-filled from the findings.
        </p>
      </div>
      <Link
        href={`/bulletins/new?from_investigation=${props.investigationId}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Draft bulletin
      </Link>
    </div>
  );
}
