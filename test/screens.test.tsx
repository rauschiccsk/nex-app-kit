// DEV-517 — every app on the template gets the back link to the previous screen and tight table rows from the kit.
// NEX DualBook 0.1.0, Vizuál 26.11.2026: the Director had to ask for both — „…riadky sú zbytočne široké berú veľa
// miesta…“ and „Chcel by som mať všade možnosť vrátiť sa na predchádzajúcu obrazovku … hore máme šípku do lava a
// napísaný názov predchádzajúcej obrazovky.“ — „Chcem aby tieto nastavenia boli založené aj pre všetky nové projekty.“
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Link, Route, useLocation } from "react-router-dom";

import * as kit from "../src";
import { KitFields, KitPage, KitTable } from "../src";
import { useNavHistory } from "../src/screens/navHistory";
import { renderApp } from "./helpers";

const AREAS = { label: "Oblasti", path: "/areas", icon: "🗂️" };
const SEARCH = { label: "Hľadanie", path: "/search", icon: "🔎" };

function Where() {
  const location = useLocation();
  return <output aria-label="adresa">{`${location.pathname}${location.search}`}</output>;
}

const ROUTES = (
  <>
    <Route
      path="/areas"
      element={
        <KitPage title="Oblasti">
          <Where />
          <Link to="/areas/7">Otvoriť oblasť 7</Link>
        </KitPage>
      }
    />
    <Route
      path="/areas/7"
      element={
        <KitPage title="Oblasť 7">
          <Where />
          <Link to="/areas/7/items/3">Otvoriť položku 3</Link>
        </KitPage>
      }
    />
    <Route path="/search" element={<KitPage title="Hľadanie" />} />
    <Route
      path="/areas/7/items/3"
      element={
        <KitPage title={<span>Položka 3</span>} crumb="Položka 3">
          <Where />
        </KitPage>
      }
    />
  </>
);

const back = () => screen.queryByRole("button", { name: /^Späť na:/ });

describe("back to the previous screen (KitPage)", () => {
  beforeEach(() => useNavHistory.setState({ stack: [] }));

  it("a screen opened from another one names it and returns there, step by step", async () => {
    renderApp({ manifest: { nav: [AREAS] }, path: "/areas", routes: ROUTES });

    await screen.findByRole("heading", { name: "Oblasti" });
    expect(back()).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Otvoriť oblasť 7" }));
    expect(await screen.findByRole("button", { name: "Späť na: Oblasti" })).toHaveTextContent(/^←\s*Oblasti$/);
    fireEvent.click(screen.getByRole("link", { name: "Otvoriť položku 3" }));
    fireEvent.click(await screen.findByRole("button", { name: "Späť na: Oblasť 7" }));

    expect(await screen.findByRole("heading", { name: "Oblasť 7" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Späť na: Oblasti" }));
    expect(await screen.findByRole("heading", { name: "Oblasti" })).toBeInTheDocument();
    expect(back()).toBeNull();
  });

  it("returns with the filter the previous screen had", async () => {
    renderApp({ manifest: { nav: [AREAS] }, path: "/areas?stav=otvorene", routes: ROUTES });

    fireEvent.click(await screen.findByRole("link", { name: "Otvoriť oblasť 7" }));
    fireEvent.click(await screen.findByRole("button", { name: "Späť na: Oblasti" }));

    await screen.findByRole("heading", { name: "Oblasti" });
    expect(screen.getByLabelText("adresa")).toHaveTextContent("/areas?stav=otvorene");
  });

  it("an entry of the left panel starts a new walk", async () => {
    renderApp({ manifest: { nav: [AREAS] }, path: "/areas", routes: ROUTES });

    fireEvent.click(await screen.findByRole("link", { name: "Otvoriť oblasť 7" }));
    await screen.findByRole("button", { name: "Späť na: Oblasti" });
    const panel = document.querySelector("aside nav") as HTMLElement;
    fireEvent.click(within(panel).getByText("Oblasti"));

    expect(await screen.findByRole("heading", { name: "Oblasti" })).toBeInTheDocument();
    expect(back()).toBeNull();
  });

  it("another entry of the left panel starts a new walk too, from deep inside one", async () => {
    renderApp({ manifest: { nav: [AREAS, SEARCH] }, path: "/areas", routes: ROUTES });

    fireEvent.click(await screen.findByRole("link", { name: "Otvoriť oblasť 7" }));
    await screen.findByRole("button", { name: "Späť na: Oblasti" });
    const panel = document.querySelector("aside nav") as HTMLElement;
    fireEvent.click(within(panel).getByText("Hľadanie"));

    expect(await screen.findByRole("heading", { name: "Hľadanie" })).toBeInTheDocument();
    expect(back()).toBeNull();
    expect(useNavHistory.getState().stack.map((s) => s.label)).toEqual(["Hľadanie"]);
  });

  it("the screen's name for the next one is its crumb when the title is not plain text", async () => {
    renderApp({ manifest: { nav: [AREAS] }, path: "/areas", routes: ROUTES });

    fireEvent.click(await screen.findByRole("link", { name: "Otvoriť oblasť 7" }));
    fireEvent.click(await screen.findByRole("link", { name: "Otvoriť položku 3" }));

    expect(await screen.findByRole("button", { name: "Späť na: Oblasť 7" })).toBeInTheDocument();
    expect(useNavHistory.getState().stack.map((s) => s.label)).toEqual(["Oblasti", "Oblasť 7", "Položka 3"]);
  });
});

describe("tight rows (KitTable, KitFields)", () => {
  it("a table keeps readable text and the least height, buttons and fields in a cell included", () => {
    const { container } = render(
      <KitTable
        columns={[{ key: "n", header: "Číslo", render: (r: { n: string }) => r.n }]}
        rows={[{ n: "DFA202700001" }]}
        getRowKey={(r) => r.n}
      />,
    );

    const classes = (container.firstElementChild as HTMLElement).className;
    expect(screen.getByText("DFA202700001")).toBeInTheDocument();
    for (const tight of ["[&_td]:py-0.5", "[&_th]:py-1", "[&_td]:leading-tight", "[&_td_button]:py-0.5", "[&_td_input]:py-0.5"]) {
      expect(classes).toContain(tight);
    }
  });

  it("a label–value list of a document header is tight too", () => {
    render(<KitFields rows={[{ label: "Dodávateľ", value: "ICC s.r.o." }]} />);

    const term = screen.getByText("Dodávateľ");
    expect(term.tagName).toBe("DT");
    expect(screen.getByText("ICC s.r.o.").tagName).toBe("DD");
    expect(term.parentElement?.className).toContain("py-0.5");
    expect(term.closest("dl")?.className).toContain("leading-tight");
  });

  it("all three are the kit's own parts", () => {
    expect([typeof kit.KitPage, typeof kit.KitTable, typeof kit.KitFields]).toEqual(["function", "function", "function"]);
  });
});
