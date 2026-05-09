// Welcome-card copy + deep-links for the supervisor / EHS manager / site_admin
// roles. Lives in a non-client module so server components (e.g. the dashboard
// page) can read it directly — exporting it from a "use client" file made the
// object opaque to RSC imports and broke the welcome card.

export type RoleWelcomeContent = {
  title: string;
  description: string;
  body: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};

export const ROLE_WELCOME_CONTENT: Record<
  "supervisor" | "ehs_manager" | "site_admin",
  RoleWelcomeContent
> = {
  supervisor: {
    title: "Welcome, {firstName}",
    description:
      "You triage incidents reported by your team — review classifications, assign owners, escalate to investigation.",
    body: "Look at the Incidents list to see what's queued. The 4 triage modals (override severity, assign owner, escalate, close) live on the incident detail page.",
    primary: { label: "Open incidents", href: "/incidents" },
    secondary: { label: "Practice report", href: "/incidents/new/1?sandbox=true" },
  },
  ehs_manager: {
    title: "Welcome, {firstName}",
    description:
      "You lead investigations, assign CAPAs, and own the regulatory paperwork. The whole pipeline reads from here.",
    body: "Investigations Kanban shows what's open. CAPAs in pending verification need an independent verifier — assign someone other than the owner. The Reports module renders OSHA 300 / 300A / 301 and RIDDOR F2508 directly from your data.",
    primary: { label: "Open Kanban", href: "/investigations" },
    secondary: { label: "Reports", href: "/reports" },
  },
  site_admin: {
    title: "Welcome, {firstName}",
    description:
      "You configure the site, manage users, and have access to the demo affordances. Start with Site Setup if you haven't already.",
    body: "Use the demo page to load a sample CAPA chain or trigger a test banner for screencaps. Reset Demo Data wipes everything back to seed — only available on demo orgs.",
    primary: { label: "Demo affordances", href: "/admin/demo" },
    secondary: { label: "Open Kanban", href: "/investigations" },
  },
};
