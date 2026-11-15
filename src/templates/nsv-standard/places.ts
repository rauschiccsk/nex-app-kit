// The template's own places and what they are called — the left panel and the top bar read the same table. DEV-394: a
// label is a key of the template's catalogs, said in the person's language where it is drawn.
export const TEMPLATE_PLACES = {
  overview: { path: "/", label: "kit.place.overview", icon: "🏠" },
  gettingStarted: { path: "/getting-started", label: "kit.place.gettingStarted", icon: "🧭" },
  updates: { path: "/updates", label: "kit.place.updates", icon: "✨" },
  settings: { path: "/settings", label: "kit.place.settings", icon: "⚙️" },
} as const;
