import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route } from "react-router-dom";
import { Button, Card, Page } from "nex-shared";
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

// Login and logout are the app's (here: a screen that lets you back in). The router keeps the place in memory, so the
// demo also runs in a frame that has no address of its own.
function Demo() {
  const [signedIn, setSignedIn] = useState(true);
  if (!signedIn) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Card className="max-w-sm text-center">
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Odhlásil si sa. Prihlásenie a odhlásenie robí aplikácia, nie šablóna.
          </p>
          <Button onClick={() => setSignedIn(true)}>Prihlásiť späť</Button>
        </Card>
      </div>
    );
  }
  return (
    <MemoryRouter>
      <TemplateApp manifest={manifest} client={demoClient} user={ME} onLogout={() => setSignedIn(false)} overview={<Overview />}>
        <Route path="/areas" element={<Simple title="Oblasti" text="Vlastná stránka aplikácie — šablóna jej dala len miesto v ráme." />} />
        <Route path="/search" element={<Simple title="Hľadanie" text="Vlastná stránka aplikácie." />} />
        <Route path="/audit" element={<Simple title="Audit" text="Položka len pre správcu." />} />
      </TemplateApp>
    </MemoryRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
