"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Wrapper around next-themes' ThemeProvider so the root layout (a server
 * component) can import a single client-component module. Behavior is the
 * same; this just satisfies Next 16.2.4's RSC import boundary.
 */
export function ThemeProvider(props: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
