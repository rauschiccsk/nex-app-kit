// The template's own places and what they are called — the left panel and the top bar read the same table.
export const TEMPLATE_PLACES = {
  overview: { path: "/", label: "Prehľad", icon: "🏠" },
  gettingStarted: { path: "/getting-started", label: "Ako začať", icon: "🧭" },
  updates: { path: "/updates", label: "Aktualizácie", icon: "✨" },
  settings: { path: "/settings", label: "Nastavenia", icon: "⚙️" },
} as const;
