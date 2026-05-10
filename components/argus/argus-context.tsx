"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_ARGUS_CONTEXT,
  type ArgusPageContext,
} from "@/lib/argus/page-context";

/**
 * Phase 9e — client-side bridge for the page-context contract.
 *
 * `<ArgusContextProvider>` wraps the (app) layout once. Server pages render
 * `<ArgusContextPayload context={ctx} />` somewhere in their tree; the
 * payload registers with the provider on mount and unregisters on unmount.
 * `<ArgusSidePanel>` (and any future Argus surface) reads the active
 * context via `useArgusPageContext()`.
 *
 * The provider keeps a single active registration (last-mount-wins) and is
 * race-safe across route transitions: an unmounting payload only clears the
 * active context if it still owns the registration. A new payload mounting
 * before the old one unmounts simply overrides; the old one's cleanup is a
 * no-op.
 */

interface ArgusContextValue {
  context: ArgusPageContext;
  register: (id: string, context: ArgusPageContext) => void;
  unregister: (id: string) => void;
}

const ArgusContextReactContext = createContext<ArgusContextValue | null>(null);

export function ArgusContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<ArgusPageContext>(DEFAULT_ARGUS_CONTEXT);
  const ownerRef = useRef<string | null>(null);

  const register = useCallback((id: string, next: ArgusPageContext) => {
    ownerRef.current = id;
    setContext(next);
  }, []);

  const unregister = useCallback((id: string) => {
    if (ownerRef.current !== id) return;
    ownerRef.current = null;
    setContext(DEFAULT_ARGUS_CONTEXT);
  }, []);

  const value = useMemo<ArgusContextValue>(
    () => ({ context, register, unregister }),
    [context, register, unregister],
  );

  return (
    <ArgusContextReactContext.Provider value={value}>
      {children}
    </ArgusContextReactContext.Provider>
  );
}

export function ArgusContextPayload({ context }: { context: ArgusPageContext }) {
  const id = useId();
  const value = useContext(ArgusContextReactContext);

  useEffect(() => {
    if (!value) return;
    value.register(id, context);
    return () => value.unregister(id);
    // We intentionally include `context` so prop updates flow through; the
    // register call is idempotent on the same id.
  }, [id, context, value]);

  return null;
}

/** Read the current page context. Returns the default outside of a provider. */
export function useArgusPageContext(): ArgusPageContext {
  const value = useContext(ArgusContextReactContext);
  return value?.context ?? DEFAULT_ARGUS_CONTEXT;
}
