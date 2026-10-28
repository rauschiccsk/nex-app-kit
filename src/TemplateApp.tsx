// The whole frame of an app, chosen by its manifest. The app keeps its router, its login and its pages:
//
//   <BrowserRouter>
//     <Routes>
//       <Route path="/login" element={<LoginPage />} />
//       <Route path="/*" element={
//         <ProtectedRoute authed={…}>
//           <TemplateApp manifest={manifest} client={api} user={user} onLogout={logout} overview={<OverviewPage />}>
//             <Route path="/areas" element={<AreasPage />} />
//           </TemplateApp>
//         </ProtectedRoute>} />
//     </Routes>
//   </BrowserRouter>
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiClient } from "nex-shared";

import { FrameContext, type Frame } from "./frame/FrameContext";
import { createLayoutStore } from "./frame/layoutStore";
import { ThemeProvider } from "./frame/theme";
import type { AppManifest } from "./manifest";
import { ADMIN_ROLE, createStandardApi, type CurrentUser } from "./standard-api";
import { TEMPLATES } from "./templates/registry";

export interface TemplateAppProps {
  manifest: AppManifest;
  /** The app's configured client (nex-shared createApiClient, prefix /api/v1). */
  client: ApiClient;
  /** The signed-in person, from the app's login. */
  user: CurrentUser | null;
  /** Leave out for an app without a logout (launched from NEX Manager). */
  onLogout?: () => void;
  /** The frontend's build version (e.g. import.meta.env.VITE_APP_VERSION). */
  frontendVersion?: string;
  /** Prehľad — the app's own overview. */
  overview: ReactNode;
  /** The app's own pages as <Route> elements. */
  children?: ReactNode;
}

export function TemplateApp({ manifest, client, user, onLogout, frontendVersion, overview, children }: TemplateAppProps) {
  const api = useMemo(() => createStandardApi(client), [client]);
  const [layout] = useState(() => createLayoutStore(api));
  const [current, setCurrent] = useState(user);
  useEffect(() => setCurrent(user), [user]);

  const frame = useMemo<Frame>(
    () => ({
      manifest,
      api,
      user: current,
      setUser: setCurrent,
      isAdmin: current?.role === ADMIN_ROLE,
      onLogout,
      frontendVersion,
      layout,
    }),
    [manifest, api, current, onLogout, frontendVersion, layout],
  );
  const Template = TEMPLATES[manifest.template];

  return (
    <FrameContext.Provider value={frame}>
      <ThemeProvider username={current?.username}>
        <Template overview={overview}>{children}</Template>
      </ThemeProvider>
    </FrameContext.Provider>
  );
}
