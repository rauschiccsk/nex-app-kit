// DEV-394 — the template speaks to each person in their language: the frame, its pages and the sign-in.
//
// 15.11.2026 the Director wanted Orthodox Hermenia in Hungarian; the template's frame was Slovak by hard. On the four
// tickets: „Áno založ všetky štyri a začni ich implementovať.“
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { check, hardTexts } from "../bin/check-texts.mjs";
import { chooseLanguage, KIT_MESSAGES } from "../src/i18n";
import { defineApp, ManifestError } from "../src/manifest";
import { ADMIN, BASE, frame, panelEntries, renderApp, UNAUTHORIZED } from "./helpers";

const BOTH = { languages: ["sk", "hu"] };

describe("the person's language (DEV-394)", () => {
  it("a person who chose Hungarian gets the frame in Hungarian", async () => {
    renderApp({ manifest: BOTH, user: { ...ADMIN, language: "hu" } });

    await frame();
    await waitFor(() => expect(panelEntries()).toEqual(["Áttekintés", "Hogyan csináljam", "Frissítések", "—", "Beállítások"]));
  });

  it("whoever chose none gets the installation's language — already on the sign-in", async () => {
    renderApp({
      manifest: BOTH,
      user: null,
      answers: { "GET /installation": { customer: null, environment: null, language: "hu", languages: ["sk", "hu"] } },
    });

    expect(await screen.findByRole("button", { name: "Bejelentkezés" })).toBeInTheDocument();
    expect(screen.getByText("Felhasználónév")).toBeInTheDocument();
  });

  it("a person who chose English gets the frame in English (DEV-398)", async () => {
    renderApp({ manifest: { languages: ["sk", "hu", "en"] }, user: { ...ADMIN, language: "en" } });

    await frame();
    await waitFor(() => expect(panelEntries()).toEqual(["Overview", "How to", "Updates", "—", "Settings"]));
  });

  it("the template's own texts exist in every language it speaks, none missing (DEV-398)", () => {
    expect(Object.keys(KIT_MESSAGES)).toEqual(["sk", "hu", "en"]);
    const keys = Object.keys(KIT_MESSAGES.sk ?? {});
    for (const language of ["hu", "en"] as const) {
      expect(Object.keys(KIT_MESSAGES[language] ?? {}).sort()).toEqual([...keys].sort());
    }
  });

  it("an app that speaks only Slovak stays Slovak, whatever the person or installation says", async () => {
    renderApp({ user: { ...ADMIN, language: "hu" } });

    await frame();
    expect(panelEntries()).toEqual(["Prehľad", "Ako urobiť", "Aktualizácie", "—", "Nastavenia"]);
  });

  it("Moje konto keeps the choice with the person and the frame changes at once", async () => {
    const { calls } = renderApp({
      manifest: BOTH,
      path: "/settings",
      answers: { "PUT /auth/language": (body: unknown) => ({ ...ADMIN, ...(body as object) }) },
    });
    await frame();
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));

    fireEvent.change(await screen.findByRole("combobox", { name: "Jazyk" }), { target: { value: "hu" } });

    await waitFor(() => expect(calls).toContainEqual({ method: "PUT", path: "/auth/language", body: { language: "hu" } }));
    await waitFor(() => expect(panelEntries()).toContain("Beállítások"));
  });

  it("the choice is offered only to an app with more than one language", async () => {
    renderApp({ path: "/settings" });
    await frame();
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));

    await screen.findByText("Moje údaje");
    expect(screen.queryByRole("combobox", { name: "Jazyk" })).toBeNull();
  });

  it("the language is the person's, else the installation's, else the app's first — one it speaks", () => {
    expect(chooseLanguage(["sk", "hu"], "hu", "sk")).toBe("hu");
    expect(chooseLanguage(["sk", "hu"], null, "hu")).toBe("hu");
    expect(chooseLanguage(["sk", "hu"], "en", "de")).toBe("sk");
    expect(chooseLanguage(["hu"], null, null)).toBe("hu");
  });

  it("the template's catalogs carry the same keys", () => {
    expect(Object.keys(KIT_MESSAGES.hu ?? {}).sort()).toEqual(Object.keys(KIT_MESSAGES.sk ?? {}).sort());
  });

  it("a signed-out app launched from NEX Manager says so in the person's language", async () => {
    renderApp({
      manifest: { ...BOTH, auth: "manager" },
      user: null,
      answers: { "GET /installation": { customer: null, environment: null, language: "hu" } },
    });

    expect(await screen.findByText("A bejelentkezés lejárt. Nyisd meg újra az alkalmazást a NEX Managerből.")).toBeInTheDocument();
  });
});

describe("the app's own texts (DEV-394)", () => {
  const MESSAGES = { sk: { "nav.areas": "Oblasti", "app.title": "Preklad" }, hu: { "nav.areas": "Területek", "app.title": "Fordítás" } };

  it("a left-panel entry named by a key is shown in the person's language", async () => {
    renderApp({
      manifest: { ...BOTH, nav: [{ label: "nav.areas", path: "/areas", icon: "🗂️" }] },
      extras: { messages: MESSAGES },
      user: { ...ADMIN, language: "hu" },
    });

    await frame();
    await waitFor(() => expect(panelEntries()).toContain("Területek"));
  });

  it("a text the app did not translate stops the app before it starts, with the key and the language", () => {
    expect(() => defineApp({ ...BASE, ...BOTH }, { messages: { sk: { "app.title": "Preklad" }, hu: {} } })).toThrow(
      new ManifestError(["Text „app.title“ nemá preklad v jazyku „hu“."]),
    );
  });

  it("what has to fit the left panel is the shown label, in every language", () => {
    const long = { sk: { "nav.x": "Krátko" }, hu: { "nav.x": "Nagyon hosszú menüpont felirata" } };
    expect(() =>
      defineApp({ ...BASE, ...BOTH, nav: [{ label: "nav.x", path: "/x", icon: "x" }] }, { messages: long }),
    ).toThrow(/Nagyon hosszú menüpont felirata/);
  });
});

describe("no text written into the code (nex-check-texts, DEV-394)", () => {
  it("the template's frame writes none — every one comes from the catalogs", () => {
    expect(check("src")).toEqual([]);
  });

  it("the rule sees each shape of a hard text, and lets a file for the agent be", () => {
    const shapes = [
      `export const A = () => <p>Zatiaľ nič</p>;`,
      `export const A = () => <input placeholder="napr. Tibor" />;`,
      `export const A = ({ b }) => <p>{b ? "Ano" : "Nie"}</p>;`,
      `export const f = (e) => e.message || "Test zlyhal (chyba spojenia).";`,
      `const f = (e, setError) => setError(e instanceof Error ? e.message : "Login failed");`,
      `const LABELS = { low: "Nízka" };`,
    ];
    for (const code of shapes) expect(hardTexts("x.tsx", code), code).not.toEqual([]);
    expect(hardTexts("x.tsx", `export const A = ({ t }) => <p className="flex gap-2" title={t("x.y")}>{t("x.z")}</p>;`)).toEqual([]);
    expect(hardTexts("x.tsx", `// texts: for the agent — sample data\nconst A = "Ukážkový správca";`)).toEqual([]);
  });
});

it("the sign-in of an app nobody signed in to is still there (sanity)", async () => {
  renderApp({ user: null, answers: { "GET /auth/me": UNAUTHORIZED } });
  expect(await screen.findByRole("button", { name: "Prihlásiť sa" })).toBeInTheDocument();
});
