// „NSV štandard“ — the first template, made from the cockpit nex-studio-visual (DEV-250, DEV-251). The template owns
// its pages (Prehľad's place, Ako začať, Aktualizácie, Nastavenia) and the frame around every page; the app adds its
// overview, its own pages and, through the manifest, its entries in the left panel.
import type { ReactNode } from "react";
import { Outlet, Route, Routes } from "react-router-dom";

import { useFrame } from "../../frame/FrameContext";
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

export function NsvStandard({ overview, children }: TemplateProps) {
  const { manifest } = useFrame();
  const modules = manifest.modules.flatMap((id) => (MODULES[id] ? [MODULES[id]] : []));

  return (
    <Routes>
      <Route element={<NsvShell />}>
        <Route path={TEMPLATE_PLACES.updates.path} element={<UpdatesPage />} />
        <Route path={TEMPLATE_PLACES.settings.path} element={<SettingsPage />} />
        <Route element={<Padded />}>
          <Route index element={overview} />
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
