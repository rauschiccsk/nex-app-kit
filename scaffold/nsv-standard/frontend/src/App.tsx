// The app on the template „NSV štandard“ (nex-app-kit). The frame — left panel, top bar, sign-in, Ako začať,
// Aktualizácie, Nastavenia — comes from the template and is never built here. The app adds its own pages as
// <Route> elements inside <TemplateApp> and their left-panel entries in app.manifest.json:
//
//   <Route path="/areas" element={<AreasPage />} />          +   { "label": "Oblasti", "path": "/areas", "icon": "🗂️" }
import type { ApiClient } from "nex-shared";
import { BrowserRouter } from "react-router-dom";
import { TemplateApp } from "nex-app-kit";

import { manifest } from "./app";
import { OverviewPage } from "./pages/OverviewPage";

/** `client` is for tests only — the app talks to its own server at the same address. */
export function App({ client }: { client?: ApiClient }) {
  return (
    <BrowserRouter>
      <TemplateApp manifest={manifest} client={client} frontendVersion={import.meta.env.VITE_APP_VERSION} overview={<OverviewPage />} />
    </BrowserRouter>
  );
}
