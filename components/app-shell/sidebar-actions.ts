"use server";

import { cookies } from "next/headers";
import { SIDEBAR_PINNED_COOKIE } from "./sidebar-cookie";

export async function setSidebarPinned(pinned: boolean) {
  const store = await cookies();
  store.set(SIDEBAR_PINNED_COOKIE, pinned ? "true" : "false", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
