// DEV-368 — an app may hide Prehľad from people who are not to see it, the way it hides its own entries.
// Director 12.11.2026 (NEX Finance: the Operátor does not see the management overview): on the proposal to let the
// template hide it — „Súhlasím“, „áno urob“. Until v0.11.2 the left panel drew Prehľad for everyone and the overview was
// every person's first screen; NEX Finance would have shown its Operátor an entry that says only „not for you“.
import { screen, waitFor } from "@testing-library/react";
import { Route } from "react-router-dom";

import { defineApp, ManifestError } from "../src/manifest";
import { PLAIN_USER, panelEntries, renderApp } from "./helpers";

const BOOK = { label: "Kniha DF", path: "/book", icon: "📒" };
const SECRET = { label: "Číselníky", path: "/codes", icon: "🗂️" };
const AUDIT = { label: "Audit", path: "/audit", icon: "🧾", adminOnly: true };

const routes = (
  <>
    <Route path="/book" element={<p>Obsah knihy</p>} />
    <Route path="/codes" element={<p>Obsah číselníkov</p>} />
    <Route path="/audit" element={<p>Obsah auditu</p>} />
  </>
);

describe("Prehľad only for some (DEV-368)", () => {
  it.each([
    [true, true],
    [false, false],
    [undefined, false],
    [null, false],
  ])("its entry shows when the app's hook says %s: %s", async (answer, shown) => {
    renderApp({ manifest: { nav: [BOOK] }, extras: { visible: { "/": () => answer } }, path: "/book", routes });

    await screen.findByText("Obsah knihy");
    expect(panelEntries().includes("Prehľad")).toBe(shown);
    expect(panelEntries()).toEqual(
      [...(shown ? ["Prehľad"] : []), "Ako začať", "Kniha DF", "Aktualizácie", "—", "Nastavenia"],
    );
  });

  it("who sees it gets the overview as the first screen", async () => {
    renderApp({ manifest: { nav: [BOOK] }, extras: { visible: { "/": () => true } } });

    expect(await screen.findByText("Obsah prehľadu")).toBeInTheDocument();
  });

  it("who does not see it lands on the first entry of the app they see, not on the overview", async () => {
    renderApp({
      manifest: { nav: [AUDIT, SECRET, BOOK] },
      extras: { visible: { "/": () => false, "/codes": () => false } },
      user: PLAIN_USER,
      routes,
    });

    expect(await screen.findByText("Obsah knihy")).toBeInTheDocument();
    expect(screen.queryByText("Obsah prehľadu")).toBeNull();
  });

  it("with no entry of the app to see, the first screen is Ako začať", async () => {
    renderApp({
      manifest: { nav: [SECRET] },
      extras: { visible: { "/": () => false, "/codes": () => false } },
      answers: { "GET /getting-started": { markdown: "# Návod aplikácie" } },
    });

    expect(await screen.findByText("Návod aplikácie")).toBeInTheDocument();
    expect(screen.queryByText("Obsah prehľadu")).toBeNull();
  });

  it("while the hook does not know yet, the overview is not shown", async () => {
    renderApp({ manifest: { nav: [BOOK] }, extras: { visible: { "/": () => undefined } }, routes });

    await waitFor(() => expect(panelEntries()).toContain("Kniha DF"));
    expect(screen.queryByText("Obsah prehľadu")).toBeNull();
    expect(screen.queryByText("Obsah knihy")).toBeNull();
  });

  it("an app without the condition shows Prehľad to everyone, as before", async () => {
    renderApp({ manifest: { nav: [BOOK] }, user: PLAIN_USER });

    expect(await screen.findByText("Obsah prehľadu")).toBeInTheDocument();
    expect(panelEntries()[0]).toBe("Prehľad");
  });

  it("the manifest takes the condition for „/“ and still refuses one for a path no entry has", () => {
    const base = { template: "nsv-standard", name: "NEX Finance", initials: "NF", auth: "manager", nav: [BOOK] };

    expect(defineApp(base, { visible: { "/": () => true } }).overviewVisible).toBeTypeOf("function");
    expect(defineApp(base).overviewVisible).toBeUndefined();
    expect(() => defineApp(base, { visible: { "/nikde": () => true } })).toThrow(ManifestError);
  });
});
