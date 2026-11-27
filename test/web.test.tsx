// DEV-523 — an app on the template may have a web (web/): its own accounts signed in by e-mail, a registration that is
// a request the admin decides in Nastavenia → Kontá webu. 26.11.2026 orthodox-register: the priests use the web, the
// administrator the administration. The Director on the proposal: „Súhlasím“; 03.11.2026: „…každú požiadavku na
// registráciu musí schváliť človek - administrátor.“
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { ApiError } from "nex-shared";

import { WebApp, defineApp } from "../src";
import type { WebAccountRead } from "../src/standard-api";
import { BASE, PLAIN_USER, fakeClient, renderApp } from "./helpers";

const WAITING: WebAccountRead = {
  id: "w1",
  email: "otec.jan@farnost.sk",
  first_name: "Ján",
  last_name: "Kňaz",
  status: "pending",
  created_at: "2026-11-26T10:00:00Z",
  decided_at: null,
};
const ACTIVE: WebAccountRead = { ...WAITING, id: "w2", email: "otec.peter@farnost.sk", first_name: "Peter", status: "active" };

async function openSettings(options: Parameters<typeof renderApp>[0]) {
  const app = renderApp({ path: "/settings", ...options });
  await screen.findByRole("tab", { name: "Systém" });
  return app;
}

describe("Nastavenia → Kontá webu (DEV-523)", () => {
  it("the admin of an app with a web decides the requests — the waiting ones first", async () => {
    const { calls } = await openSettings({
      manifest: { web: true },
      answers: {
        "GET /web-accounts": [ACTIVE, WAITING],
        "POST /web-accounts/w1/approve": { ...WAITING, status: "active" },
      },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Kontá webu" }));

    expect(await screen.findByText("Čakajúce žiadosti: 1")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0] as HTMLElement).getByText("otec.jan@farnost.sk")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Čaká na schválenie")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).queryByRole("button", { name: "Schváliť" })).toBeNull();
    expect(within(rows[1] as HTMLElement).getByRole("button", { name: "Vypnúť" })).toBeInTheDocument();
    fireEvent.click(within(rows[0] as HTMLElement).getByRole("button", { name: "Schváliť" }));

    await waitFor(() => expect(screen.queryByText("Čakajúce žiadosti: 1")).toBeNull());
    expect(calls.some((c) => c.method === "POST" && c.path === "/web-accounts/w1/approve")).toBe(true);
  });

  it("is the admin's only, and only in an app with a web", async () => {
    await openSettings({ manifest: { web: true }, user: PLAIN_USER });
    expect(screen.queryByRole("tab", { name: "Kontá webu" })).toBeNull();
  });

  it("an app without a web has no such tab", async () => {
    await openSettings({});
    expect(screen.queryByRole("tab", { name: "Kontá webu" })).toBeNull();
  });
});

const MANIFEST = defineApp({ ...BASE, name: "Orthodox Register", initials: "OR", web: true });
const NOBODY = new ApiError(401, "Na webe nie ste prihlásený.", { detail: "Na webe nie ste prihlásený.", code: "KIT-AUTH-REQUIRED" });

function renderWeb(answers: Record<string, unknown>, path = "/") {
  const fake = fakeClient(answers as never);
  render(
    <MemoryRouter initialEntries={[path]}>
      <WebApp manifest={MANIFEST} client={fake.client} home={<p>Matriky farnosti</p>}>
        <Route path="/zaznamy" element={<p>Záznamy</p>} />
      </WebApp>
    </MemoryRouter>,
  );
  return fake;
}

describe("the web (DEV-523)", () => {
  it("nobody signed in sees the sign-in by e-mail; a waiting request is told so", async () => {
    const pending = new ApiError(403, "Vaša žiadosť o registráciu ešte čaká na schválenie správcom.", {
      detail: "Vaša žiadosť o registráciu ešte čaká na schválenie správcom.",
      code: "KIT-WEB-PENDING",
    });
    const { calls } = renderWeb({ "GET /web/auth/me": NOBODY, "POST /web/auth/login": pending });

    fireEvent.change(await screen.findByLabelText("E-mail"), { target: { value: " otec.jan@farnost.sk " } });
    fireEvent.change(screen.getByLabelText("Heslo"), { target: { value: "heslo-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Prihlásiť sa" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Vaša žiadosť o registráciu ešte čaká na schválenie správcom.");
    expect(calls).toContainEqual({ method: "POST", path: "/web/auth/login", body: { email: "otec.jan@farnost.sk", password: "heslo-1" } });
    expect(screen.queryByText("Matriky farnosti")).toBeNull();
  });

  it("a registration sends the request and says it waits for the administrator", async () => {
    const { calls } = renderWeb({ "GET /web/auth/me": NOBODY, "POST /web/auth/register": WAITING }, "/register");

    fireEvent.change(await screen.findByLabelText("Meno"), { target: { value: "Ján" } });
    fireEvent.change(screen.getByLabelText("Priezvisko"), { target: { value: "Kňaz" } });
    fireEvent.change(screen.getByLabelText("E-mail"), { target: { value: "otec.jan@farnost.sk" } });
    fireEvent.change(screen.getByLabelText("Heslo"), { target: { value: "heslo-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Odoslať žiadosť" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Žiadosť sme prijali. Prihlásiť sa budete môcť, keď ju správca schváli.",
    );
    expect(calls).toContainEqual({
      method: "POST",
      path: "/web/auth/register",
      body: { first_name: "Ján", last_name: "Kňaz", email: "otec.jan@farnost.sk", password: "heslo-1" },
    });
  });

  it("the signed-in priest has the web's pages, the name in the top bar, and signs out", async () => {
    const { calls } = renderWeb({ "GET /web/auth/me": ACTIVE, "POST /web/auth/logout": undefined });

    expect(await screen.findByText("Matriky farnosti")).toBeInTheDocument();
    expect(screen.getByText("Peter Kňaz")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Odhlásiť sa" }));

    expect(await screen.findByRole("button", { name: "Prihlásiť sa" })).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST" && c.path === "/web/auth/logout")).toBe(true);
  });

  it("the app's own web pages are there for the signed-in person", async () => {
    renderWeb({ "GET /web/auth/me": ACTIVE }, "/zaznamy");
    expect(await screen.findByText("Záznamy")).toBeInTheDocument();
  });
});
