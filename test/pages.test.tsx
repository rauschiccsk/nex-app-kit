// DEV-251 — the template's own pages: Ako začať and Aktualizácie read the app's server; an unknown address and a page
// that crashes say so, with the left panel and the top bar still there.
import { screen } from "@testing-library/react";
import { Route } from "react-router-dom";

import { renderApp } from "./helpers";

describe("pages of the template", () => {
  it("Prehľad is the app's own overview", async () => {
    renderApp({ path: "/" });

    expect(await screen.findByText("Obsah prehľadu")).toBeInTheDocument();
  });

  it("Ako začať shows the guide the server holds", async () => {
    renderApp({
      path: "/getting-started",
      answers: { "GET /getting-started": { markdown: "## Prvé kroky\n\nOtvor **Oblasti** a založ prvú." } },
    });

    expect(await screen.findByRole("heading", { name: "Prvé kroky" })).toBeInTheDocument();
    expect(screen.getByText("Oblasti")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Ako začať" })).toBeInTheDocument();
  });

  it("Ako začať without a guide says so", async () => {
    renderApp({ path: "/getting-started" });

    expect(await screen.findByText("Návod k aplikácii ešte nie je napísaný.")).toBeInTheDocument();
  });

  it("Ako začať that cannot be read says why", async () => {
    renderApp({ path: "/getting-started", answers: { "GET /getting-started": new Error("Server neodpovedá.") } });

    expect(await screen.findByText("Návod sa nepodarilo načítať: Server neodpovedá.")).toBeInTheDocument();
  });

  it("Aktualizácie list the versions from the server", async () => {
    renderApp({
      path: "/updates",
      answers: {
        "GET /release-notes": [{ version: "0.2.0", released_at: "2026-10-28", markdown: "- Hľadanie v oblastiach" }],
      },
    });

    expect(await screen.findByText("Hľadanie v oblastiach")).toBeInTheDocument();
    expect(screen.getByText(/v jednotlivých verziách NEX Knowledge/)).toBeInTheDocument();
  });

  it("an app page goes where its manifest entry points", async () => {
    renderApp({
      path: "/areas",
      manifest: { nav: [{ label: "Oblasti", path: "/areas", icon: "🗂️" }] },
      routes: <Route path="/areas" element={<p>Zoznam oblastí</p>} />,
    });

    expect(await screen.findByText("Zoznam oblastí")).toBeInTheDocument();
  });

  it("an address nobody serves says so and leads back", async () => {
    renderApp({ path: "/neexistuje" });

    expect(await screen.findByText("Stránka neexistuje")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Späť na Prehľad" })).toHaveAttribute("href", "/");
  });

  it("a page that crashes says so; the left panel and the top bar stay", async () => {
    const Broken = () => {
      throw new Error("pokazené počítanie");
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderApp({ path: "/areas", manifest: { nav: [{ label: "Oblasti", path: "/areas", icon: "🗂️" }] }, routes: <Route path="/areas" element={<Broken />} /> });

    expect(await screen.findByRole("alert")).toHaveTextContent("Stránka narazila na chybu");
    expect(screen.getByRole("alert")).toHaveTextContent("pokazené počítanie");
    expect(screen.getByRole("button", { name: "Nastavenia" })).toBeInTheDocument();
    expect(document.querySelector("header")).toHaveTextContent("Oblasti");
  });
});
