# nex-app-kit — šablóny aplikácií ICC

Rám aplikácie podľa šablóny: ľavý panel, horná lišta, stránky Ako začať, Aktualizácie a Nastavenia a ich napojenie
na štandardné rozhranie servera. Aplikácia rám **nekopíruje** — používa ho pripnutý na verziu, ako nex-shared, a svoju
podobu opíše v jednom súbore, v manifeste. Vylepšenie šablóny dostane aplikácia povýšením verzie bez zmeny svojho kódu
(návrh DEV-250, fáza 1 DEV-251).

## Šablóny

| šablóna | odkiaľ | čo dodá |
|---|---|---|
| `nsv-standard` | kokpit nex-studio-visual | ľavý panel (Prehľad, Ako začať, voliteľné moduly a vlastné položky, Aktualizácie, čiara, Nastavenia; používateľ v pätičke; šírka a zbalenie pamätané pre každého na serveri), horná lišta (kde som, svetlá/tmavá téma), Ako začať, Aktualizácie, Nastavenia (Systém, Agenti, Moje konto, Používatelia, Relácie) |

## Manifest aplikácie

```ts
// src/app.manifest.ts
import { defineApp } from "nex-app-kit";

export default defineApp({
  template: "nsv-standard",
  name: "NEX Knowledge",
  initials: "NK",
  auth: "manager",                 // "password" = vlastné heslo, "manager" = spustenie z NEX Managera
  ai: { roles: [{ id: "assistant", label: "Asistent" }] },
  nav: [{ label: "Oblasti", path: "/areas", icon: "🗂️" }],
  settings: { categories: [{ id: "search", label: "Hľadanie", description: "…", prefixes: ["search_"] }] },
});
```

Zlá hodnota zastaví štart a každý problém povie jednou vetou (`ManifestError.problems`). Položka ľavého panela má
najviac 22 znakov, ikonu, cestu s lomkou a nesmie zabrať cestu šablóny (`/`, `/getting-started`, `/updates`,
`/settings`).

**Spôsob prihlásenia riadi Nastavenia:** s vlastným heslom má aplikácia Používateľov a Moje konto na úpravu; pri
spustení z NEX Managera Používateľov nemá a Moje konto len ukáže účet, ktorý sa mení v NEX Manageri. Agenti sú len pri
aplikácii s AI. Používateľov a Agentov vidí len správca.

## Použitie v aplikácii

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/*" element={
      <ProtectedRoute authed={…}>
        <TemplateApp manifest={manifest} client={api} user={user} onLogout={logout}
                     frontendVersion={import.meta.env.VITE_APP_VERSION} overview={<OverviewPage />}>
          <Route path="/areas" element={<AreasPage />} />
        </TemplateApp>
      </ProtectedRoute>} />
  </Routes>
</BrowserRouter>
```

Štýl aplikácie (`src/index.css`):

```css
@import "tailwindcss";
@import "nex-shared/tokens.css";
@import "nex-app-kit/frame.css";
@source "../node_modules/nex-shared/dist";
```

Aplikácia inštaluje aj `@tailwindcss/typography` (Ako začať je v tvare Markdown).

## Štandardné rozhranie servera

Cesty, ktoré rám volá, a kto ich smie, opisuje [KONTRAKT.md](KONTRAKT.md). Serverovú časť dodá fáza 2.

## Vývoj

```
npm ci
npm run lint        # typy
npm test            # skúšky
npm run build       # dist/ (je v gite — aplikácie inštalujú zo značky bez stavby)
npm run demo        # ukážková aplikácia so serverom v pamäti
```

Verzia = značka `vX.Y.Z`; každá verzia má záznam v [CHANGELOG.md](CHANGELOG.md).
