import { redirect } from "next/navigation";

export default function SettingsIndex() {
  // Phase 17 — the bare /settings landing is /settings/profile. We don't try
  // to remember the user's last visited tab; the avatar dropdown always
  // lands here, and Profile is the natural first stop.
  redirect("/settings/profile");
}
