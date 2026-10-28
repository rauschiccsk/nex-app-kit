// DEV-251 — the manifest of an app: what the template needs to know, checked before the app starts.
// Director 28.10.2026: „pri každom novom projekte by som mal možnosť vybrať vytvoriť vizuál novej aplikácie podľa
// nejakého šablónu“ — the app describes itself in one file; a wrong value stops it with a sentence saying what is wrong.
import { describe, expect, it } from "vitest";

import { ManifestError, defineApp } from "../src/manifest";

const MINIMAL = { template: "nsv-standard", name: "NEX Knowledge", initials: "NK", auth: "manager" } as const;

function problems(input: unknown): string[] {
  try {
    defineApp(input as never);
  } catch (e) {
    expect(e).toBeInstanceOf(ManifestError);
    return (e as ManifestError).problems;
  }
  throw new Error("defineApp accepted it");
}

describe("defineApp", () => {
  it("fills what an app does not have to say", () => {
    const app = defineApp(MINIMAL);

    expect(app).toEqual({ ...MINIMAL, ai: false, modules: [], nav: [], settings: { categories: [] } });
    expect(Object.isFrozen(app)).toBe(true);
  });

  it("keeps the app's own entries, AI roles and setting categories", () => {
    const app = defineApp({
      ...MINIMAL,
      auth: "password",
      ai: { roles: [{ id: "assistant", label: "Asistent" }] },
      nav: [{ label: "Oblasti", path: "/areas", icon: "🗂️" }],
      settings: { categories: [{ id: "search", label: "Hľadanie", description: "Kvalita hľadania.", prefixes: ["search_"] }] },
    });

    expect(app.auth).toBe("password");
    expect(app.ai).toEqual({ roles: [{ id: "assistant", label: "Asistent" }] });
    expect(app.nav.map((n) => n.path)).toEqual(["/areas"]);
    expect(app.settings.categories.map((c) => c.id)).toEqual(["search"]);
  });

  it("names an unknown template and the ones there are", () => {
    expect(problems({ ...MINIMAL, template: "iny-vzhlad" })).toEqual([
      "Šablóna „iny-vzhlad“ neexistuje — sú tieto: nsv-standard.",
    ]);
  });

  it("says every problem at once, not one by one", () => {
    expect(problems({ template: "nsv-standard", name: " ", initials: "nexknow", auth: "heslo" })).toEqual([
      "Chýba názov aplikácie (name).",
      "Iniciály (initials) majú 1 až 4 znaky — „nexknow“ má 7.",
      "Spôsob prihlásenia (auth) je „password“ (vlastné heslo) alebo „manager“ (spustenie z NEX Managera), nie „heslo“.",
    ]);
  });

  it("keeps the template's own pages and paths to the template", () => {
    expect(
      problems({
        ...MINIMAL,
        nav: [
          { label: "Domov", path: "/", icon: "🏠" },
          { label: "Nastavenia", path: "/settings", icon: "⚙️" },
          { label: "Oblasti", path: "areas", icon: "🗂️" },
        ],
      }),
    ).toEqual([
      "Položka „Domov“: cesta „/“ patrí šablóne (Prehľad, Ako začať, Aktualizácie, Nastavenia).",
      "Položka „Nastavenia“: cesta „/settings“ patrí šablóne (Prehľad, Ako začať, Aktualizácie, Nastavenia).",
      "Položka „Oblasti“: cesta „areas“ musí začínať lomkou.",
    ]);
  });

  it("wants a menu entry short enough for one line, with an icon, once", () => {
    expect(
      problems({
        ...MINIMAL,
        nav: [
          { label: "Uchovávanie a odstraňovanie", path: "/statutory", icon: "⚖️" },
          { label: "Oblasti", path: "/areas", icon: "" },
          { label: "Oblasti", path: "/areas", icon: "🗂️" },
        ],
      }),
    ).toEqual([
      "Položka „Uchovávanie a odstraňovanie“ má 27 znakov — v ľavom paneli sa zmestí najviac 22.",
      "Položka „Oblasti“ nemá ikonu.",
      "Položka „Oblasti“ je v ľavom paneli dvakrát.",
      "Cesta „/areas“ je v ľavom paneli dvakrát.",
    ]);
  });

  it("an app with AI names its agent roles, each once", () => {
    expect(problems({ ...MINIMAL, ai: { roles: [] } })).toEqual([
      "Aplikácia s AI (ai) menuje aspoň jednu rolu agenta.",
    ]);
    expect(
      problems({
        ...MINIMAL,
        ai: { roles: [{ id: "assistant", label: "Asistent" }, { id: "assistant", label: "Druhý" }] },
      }),
    ).toEqual(["Rola agenta „assistant“ je uvedená dvakrát."]);
  });

  it("an optional module the kit does not have yet is named", () => {
    expect(problems({ ...MINIMAL, modules: ["notes"] })).toEqual([
      "Voliteľný modul „notes“ šablóna zatiaľ nemá — dostupné: žiadne.",
    ]);
  });
});
