// „NSV štandard“ — the first template, made from the cockpit nex-studio-visual (DEV-250, DEV-251). The template owns
// its pages (Prehľad's place, Ako začať, Aktualizácie, Nastavenia) and the frame around every page; the app adds its
// overview, its own pages and, through the manifest, its entries in the left panel.
import type { ReactNode } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { useFrame } from "../../frame/FrameContext";
import type { AppManifest } from "../../manifest";
import { MODULES } from "../../modules";
import type { TemplateProps } from "../types";
import { GettingStartedPage } from "./pages/GettingStartedPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { SettingsPage } from "./pages/SettingsPage";
import { UpdatesPage } from "./pages/UpdatesPage";
import { TEMPLATE_PLACES } from "./places";
import { NsvShell } from "./Shell";

/** The page's room inside the frame; Nastavenia and Aktualizácie arrange their own. */
function Padded({ children }: { children?: ReactNode }) {
  return <div className="p-6">{children ?? <Outlet />}</div>;
}

const everyone = () => true;

/** DEV-368: where a person who does not see Prehľad starts — the app's first entry they see (no condition of its own,
 *  not an admin's entry for someone else), else Ako začať, which everyone sees. */
function firstPlaceWithoutOverview(manifest: AppManifest, isAdmin: boolean): string {
  const own = manifest.nav.find((e) => !e.useVisible && (!e.adminOnly || isAdmin));
  return own?.path ?? TEMPLATE_PLACES.gettingStarted.path;
}

/** The first screen: the app's overview for whom the app says sees it; the others start at their first entry; while
 *  the app does not know yet, nothing — never the overview to someone who may not see it. */
function OverviewPlace({ overview }: { overview: ReactNode }) {
  const { manifest, isAdmin } = useFrame();
  const useOverviewVisible = manifest.overviewVisible ?? everyone;
  const answer = useOverviewVisible();
  if (answer === true) return <>{overview}</>;
  if (answer === false) return <Navigate to={firstPlaceWithoutOverview(manifest, isAdmin)} replace />;
  return null;
}

export function NsvStandard({ overview, children }: TemplateProps) {
  const { manifest } = useFrame();
  const modules = manifest.modules.flatMap((id) => (MODULES[id] ? [MODULES[id]] : []));

  return (
    <Routes>
      <Route element={<NsvShell />}>
        <Route path={TEMPLATE_PLACES.updates.path} element={<UpdatesPage />} />
        <Route path={TEMPLATE_PLACES.settings.path} element={<SettingsPage />} />
        <Route element={<Padded />}>
          <Route index element={<OverviewPlace overview={overview} />} />
          <Route path={TEMPLATE_PLACES.gettingStarted.path} element={<GettingStartedPage />} />
          {modules.map((m) => (
            <Route key={m.id} path={`${m.path}/*`} element={m.page()} />
          ))}
          {children}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
