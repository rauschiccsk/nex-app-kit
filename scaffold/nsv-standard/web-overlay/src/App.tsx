// The web of the app (web/) on the template „NSV štandard“ (nex-app-kit) — beside its administration (frontend/), on
// the same server. The frame — sign-in by e-mail, the registration request the administrator decides, the top bar —
// comes from the template (WebApp) and is never built here. The web adds its own pages as <Route> elements:
//
//   <Route path="/zaznamy" element={<RecordsPage />} />
import type { ApiClient } from "nex-shared";
import { BrowserRouter } from "react-router-dom";
import { WebApp } from "nex-app-kit";

import { manifest } from "./app";
import { HomePage } from "./pages/HomePage";

/** `client` is for tests only — the web talks to its own server at the same address. */
export function App({ client }: { client?: ApiClient }) {
  return (
    <BrowserRouter>
      <WebApp manifest={manifest} client={client} home={<HomePage />} />
    </BrowserRouter>
  );
}
