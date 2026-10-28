import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route } from "react-router-dom";
import { Card, Page } from "nex-shared";
import { TemplateApp } from "nex-app-kit";

import "./demo.css";
import manifest from "./app.manifest";
import { ME, demoClient } from "./fakeServer";

function Overview() {
  return (
    <Page title="Prehľad" subtitle="Čo sa v aplikácii deje — ukážka šablóny NSV štandard.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">Oblasti</div>
          <div className="mt-1 text-2xl font-bold">3</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">Dokumenty</div>
          <div className="mt-1 text-2xl font-bold">128</div>
        </Card>
        <Card>
          <div className="text-xs text-[var(--color-text-muted)]">Posledná zmena</div>
          <div className="mt-1 text-2xl font-bold">28. 10. 2026</div>
        </Card>
      </div>
    </Page>
  );
}

function Simple({ title, text }: { title: string; text: string }) {
  return (
    <Page title={title}>
      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]">{text}</p>
      </Card>
    </Page>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <TemplateApp manifest={manifest} client={demoClient} user={ME} onLogout={() => window.alert("Odhlásenie robí aplikácia.")} overview={<Overview />}>
        <Route path="/areas" element={<Simple title="Oblasti" text="Vlastná stránka aplikácie — šablóna jej dala len miesto v ráme." />} />
        <Route path="/search" element={<Simple title="Hľadanie" text="Vlastná stránka aplikácie." />} />
        <Route path="/audit" element={<Simple title="Audit" text="Položka len pre správcu." />} />
      </TemplateApp>
    </HashRouter>
  </StrictMode>,
);
