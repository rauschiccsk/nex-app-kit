// DEV-251 — the frame of the template „NSV štandard“: the left panel, the footer and the top bar read exactly as the
// cockpit's do. Director 28.10.2026: „ľavý panel presne taký ako máme v NSV … Prehlad, Ako začať, Aktualizácie,
// vodorovná čiara, Nastavenia majú byť v každej aplikáciu“.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { ADMIN, LAYOUT, PLAIN_USER, frame, panelEntries, renderApp } from "./helpers";

const AREAS = { label: "Oblasti", path: "/areas", icon: "🗂️" };
const SEARCH = { label: "Hľadanie", path: "/search", icon: "🔎" };

describe("left panel", () => {
  it("reads as the cockpit's: Prehľad, Ako začať, the app's entries, Aktualizácie, a line, Nastavenia", async () => {
    renderApp({ manifest: { nav: [AREAS, SEARCH] } });

    await screen.findByText("v0.1.0");
    expect(panelEntries()).toEqual(["Prehľad", "Ako začať", "Oblasti", "Hľadanie", "Aktualizácie", "—", "Nastavenia"]);
  });

  it("an app without entries of its own still has the template's", async () => {
    renderApp();

    await screen.findByText("v0.1.0");
    expect(panelEntries()).toEqual(["Prehľad", "Ako začať", "Aktualizácie", "—", "Nastavenia"]);
  });

  it("an entry for the admin is there for the admin only", async () => {
    const audit = { label: "Audit", path: "/audit", icon: "🧾", adminOnly: true };
    renderApp({ manifest: { nav: [AREAS, audit] }, user: PLAIN_USER });
    await screen.findByText("v0.1.0");
    expect(panelEntries()).not.toContain("Audit");
  });

  it("an entry for the admin shows for the admin", async () => {
    const audit = { label: "Audit", path: "/audit", icon: "🧾", adminOnly: true };
    renderApp({ manifest: { nav: [AREAS, audit] }, user: ADMIN });
    await screen.findByText("v0.1.0");
    expect(panelEntries()).toContain("Audit");
  });

  it("an entry's count stands beside its name", async () => {
    renderApp({ manifest: { nav: [{ ...AREAS, useCount: () => 3 }, SEARCH] } });

    await screen.findByText("v0.1.0");
    expect(panelEntries()).toContain("Oblasti(3)");
    expect(panelEntries()).toContain("Hľadanie");
  });

  it("an entry opens its page and is marked as the current one", async () => {
    renderApp({ manifest: { nav: [AREAS] } });

    fireEvent.click(await screen.findByRole("button", { name: "Oblasti" }));

    expect(await screen.findByRole("button", { name: "Oblasti" })).toHaveClass("bg-primary-600/10");
    expect(screen.getByRole("button", { name: "Prehľad" })).not.toHaveClass("bg-primary-600/10");
  });

  it("the brand names the app and the version its server reports", async () => {
    renderApp({ answers: { "GET /health": { status: "ok", version: "1.2.3" } } });

    expect(await screen.findByText("v1.2.3")).toBeInTheDocument();
    expect(screen.getByText("NEX Knowledge")).toBeInTheDocument();
    expect(screen.getByText("NK")).toBeInTheDocument();
  });

  it("a frontend of another version than the server says both", async () => {
    renderApp({ answers: { "GET /health": { status: "ok", version: "1.2.3" } }, frontendVersion: "1.2.2" });

    expect(await screen.findByText("backend v1.2.3 · frontend v1.2.2")).toBeInTheDocument();
  });
});

describe("footer", () => {
  it("names the person and their role", async () => {
    renderApp({ user: ADMIN });

    const { aside } = await frame();
    expect(await within(aside).findByText("Ján Novák")).toBeInTheDocument();
    expect(within(aside).getByText("Správca")).toBeInTheDocument();
  });

  it("a person without a name is named by the login", async () => {
    renderApp({ user: { ...PLAIN_USER, first_name: "", last_name: null } });

    const { aside } = await frame();
    expect(await within(aside).findByText("eva")).toBeInTheDocument();
    expect(within(aside).getByText("Používateľ")).toBeInTheDocument();
  });

  it("logging out ends the session and leads to signing in", async () => {
    const { calls } = renderApp();

    fireEvent.click(await screen.findByTitle("Odhlásiť sa"));

    expect(await screen.findByRole("button", { name: "Prihlásiť sa" })).toBeInTheDocument();
    expect(calls).toContainEqual({ method: "POST", path: "/auth/logout" });
    expect(document.querySelector("aside")).toBeNull();
  });

  it("launched from NEX Manager, logging out says the way back is NEX Manager", async () => {
    renderApp({ manifest: { auth: "manager" } });

    fireEvent.click(await screen.findByTitle("Odhlásiť sa"));

    expect(await screen.findByText("Odhlásenie prebehlo. Aplikáciu otvoríš znova z NEX Managera.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prihlásiť sa" })).not.toBeInTheDocument();
  });
});

describe("layout kept on the server for each person", () => {
  it("the width comes from the person's layout", async () => {
    renderApp({ answers: { "GET /user-layout": { ...LAYOUT, sidebar_width: 300 } } });

    await waitFor(() => expect(document.querySelector("aside")).toHaveStyle({ width: "300px" }));
  });

  it("collapsing the panel is kept on the server", async () => {
    const { calls } = renderApp();
    await waitFor(() => expect(calls.some((c) => c.method === "GET" && c.path === "/user-layout")).toBe(true));

    fireEvent.click(await screen.findByTitle("Zúžiť"));

    await waitFor(() =>
      expect(calls).toContainEqual({ method: "PUT", path: "/user-layout", body: { sidebar_collapsed: true } }),
    );
    expect(await screen.findByTitle("Rozšíriť")).toBeInTheDocument();
  });

  it("a layout the server refused does not stay on the screen", async () => {
    renderApp({ answers: { "PUT /user-layout": new Error("Šírka mimo hraníc.") } });
    await screen.findByText("v0.1.0");

    fireEvent.click(await screen.findByTitle("Zúžiť"));

    expect(await screen.findByTitle("Zúžiť")).toBeInTheDocument();
  });
});

describe("top bar", () => {
  it.each([
    ["/", "Prehľad"],
    ["/getting-started", "Ako začať"],
    ["/updates", "Aktualizácie"],
    ["/settings", "Nastavenia"],
    ["/areas", "Oblasti"],
    ["/areas/12", "Oblasti"],
    ["/nieco-ine", "NEX Knowledge"],
  ])("on %s says %s", async (path, label) => {
    renderApp({ path, manifest: { nav: [AREAS] } });

    const { header } = await frame();
    expect(await within(header).findByText(label)).toBeInTheDocument();
  });

  it("switches the theme and remembers it for the person", async () => {
    renderApp({ user: ADMIN });
    await screen.findByText("v0.1.0");
    expect(document.documentElement).toHaveClass("dark");

    fireEvent.click(screen.getByRole("button", { name: "Prepnúť na svetlú tému" }));

    expect(document.documentElement).not.toHaveClass("dark");
    expect(window.localStorage.getItem("nex_dark_jan")).toBe("false");
  });
});
