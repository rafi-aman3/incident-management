"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Numeric counter that eases from 0 → target on mount.
 *
 * Accepts the same value the caller would otherwise render — a number, or a
 * formatted string ("35.0", "—", "n/a"). When the input parses as a finite
 * number, it animates with the same decimal precision as the input; when it
 * doesn't, it renders the string verbatim. Honors `prefers-reduced-motion`
 * by snapping straight to the final value.
 */
export function AnimatedNumber({
  value,
  durationMs = 900,
  delayMs = 0,
  className,
}: {
  value: string | number;
  durationMs?: number;
  delayMs?: number;
  className?: string;
}) {
  const stringValue = typeof value === "number" ? String(value) : value;
  const target = typeof value === "number" ? value : parseFloat(value);
  const animatable = Number.isFinite(target);
  const [display, setDisplay] = useState(animatable ? "0" : stringValue);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!animatable) return;
    startedRef.current = false;
    startedRef.current = true;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const decimals = stringValue.includes(".")
      ? stringValue.split(".")[1].length
      : 0;
    const duration = reduced ? 0 : durationMs;
    const start = performance.now() + (reduced ? 0 : delayMs);

    let raf = 0;
    const tick = (now: number) => {
      if (duration === 0) {
        setDisplay(stringValue);
        return;
      }
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      setDisplay(decimals ? v.toFixed(decimals) : Math.round(v).toString());
      if (t < 1) raf = requestAnimationFrame(tick);
      else setDisplay(stringValue);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stringValue, animatable, target, durationMs, delayMs]);

  return <span className={className}>{display}</span>;
}
