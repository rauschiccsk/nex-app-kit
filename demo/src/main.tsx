import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route } from "react-router-dom";
import { Card, createApiClient, Page } from "nex-shared";
import { TemplateApp } from "nex-app-kit";

import "./demo.css";
import manifest from "./app.manifest";

// The app's own pages call its own routes with their own client — the session cookie goes along by itself.
const api = createApiClient({ baseUrl: "", apiPrefix: "/api/v1", getToken: () => null });

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

function Areas() {
  const [areas, setAreas] = useState<string[]>([]);
  useEffect(() => {
    api.get<{ areas: string[] }>("/areas").then((r) => setAreas(r.areas), () => setAreas([]));
  }, []);
  return (
    <Page title="Oblasti" subtitle="Vlastná stránka aplikácie — volá vlastnú cestu servera, ktorá sa pýta šablóny, kto je prihlásený.">
      <Card>
        <ul className="list-disc pl-5 text-sm text-[var(--color-text-secondary)]">
          {areas.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </Card>
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
    <MemoryRouter>
      <TemplateApp manifest={manifest} frontendVersion="0.2.0" overview={<Overview />}>
        <Route path="/areas" element={<Areas />} />
        <Route path="/search" element={<Simple title="Hľadanie" text="Vlastná stránka aplikácie." />} />
        <Route path="/audit" element={<Simple title="Audit" text="Položka len pre správcu." />} />
      </TemplateApp>
    </MemoryRouter>
  </StrictMode>,
);
