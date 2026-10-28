// The manifest of the demo app — what an app on the template writes about itself.
import { defineApp } from "nex-app-kit";

import { useAreaCount } from "./fakeServer";

export default defineApp({
  template: "nsv-standard",
  name: "NEX Ukážka",
  initials: "NU",
  auth: "password",
  ai: { roles: [{ id: "assistant", label: "Asistent" }] },
  nav: [
    { label: "Oblasti", path: "/areas", icon: "🗂️", useCount: useAreaCount },
    { label: "Hľadanie", path: "/search", icon: "🔎" },
    { label: "Audit", path: "/audit", icon: "🧾", adminOnly: true },
  ],
  settings: {
    categories: [
      { id: "search", label: "Hľadanie", description: "Ako hľadanie vyberá a zoraďuje výsledky.", prefixes: ["search_"] },
      { id: "retention", label: "Uchovávanie", description: "Ako dlho aplikácia drží záznamy.", prefixes: ["retention_"] },
    ],
  },
});
