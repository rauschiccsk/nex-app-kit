// DEV-252 — the frame knows the session itself: it asks the server who is signed in and shows the sign-in (own
// password), the way back through NEX Manager (launched from it), the password change due, or a server that does not
// answer. The session is a cookie the page never sees; a 401 while working sends the person back to signing in.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import { ApiError, Button, createApiClient } from "nex-shared";

import { defineApp } from "../src/manifest";
import { TemplateApp } from "../src/TemplateApp";
import { ADMIN, BASE, UNAUTHORIZED, frame, renderApp } from "./helpers";

function typeInto(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("before the frame", () => {
  it("says it is loading while it asks who is signed in", async () => {
    renderApp();

    expect(screen.getByText("Načítavam…")).toBeInTheDocument();
    await frame();
    expect(screen.queryByText("Načítavam…")).not.toBeInTheDocument();
  });

  it("own password, nobody signed in: the sign-in, then the frame", async () => {
    const { calls } = renderApp({ user: null, answers: { "POST /auth/login": ADMIN } });

    await screen.findByRole("button", { name: "Prihlásiť sa" });
    typeInto("Prihlasovacie meno", "jan");
    typeInto("Heslo", "heslo-123");
    fireEvent.click(screen.getByRole("button", { name: "Prihlásiť sa" }));

    await frame();
    expect(calls).toContainEqual({ method: "POST", path: "/auth/login", body: { username: "jan", password: "heslo-123" } });
    expect(screen.getByText("Obsah prehľadu")).toBeInTheDocument();
  });

  it("a refused sign-in says the server's sentence", async () => {
    renderApp({
      user: null,
      answers: { "POST /auth/login": new ApiError(401, "Nesprávne meno alebo heslo.", { detail: "Nesprávne meno alebo heslo." }) },
    });

    await screen.findByRole("button", { name: "Prihlásiť sa" });
    typeInto("Prihlasovacie meno", "jan");
    typeInto("Heslo", "zle");
    fireEvent.click(screen.getByRole("button", { name: "Prihlásiť sa" }));

    expect(await screen.findByText("Nesprávne meno alebo heslo.")).toBeInTheDocument();
    expect(document.querySelector("aside")).toBeNull();
  });

  it("launched from NEX Manager, nobody signed in: the way back is NEX Manager, no form", async () => {
    renderApp({ user: null, manifest: { auth: "manager" } });

    expect(await screen.findByText("Prihlásenie vypršalo. Aplikáciu otvor znova z NEX Managera.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Heslo")).not.toBeInTheDocument();
  });

  it("a password change due comes before anything else", async () => {
    const { calls } = renderApp({ user: { ...ADMIN, must_change_password: true } });

    await screen.findByRole("heading", { name: "Nastav si vlastné heslo" });
    expect(document.querySelector("aside")).toBeNull();
    typeInto("Súčasné heslo", "pociatocne");
    typeInto("Nové heslo", "nove-heslo-1");
    typeInto("Zopakuj nové heslo", "nove-heslo-1");
    fireEvent.click(screen.getByRole("button", { name: "Nastaviť heslo" }));

    await frame();
    expect(calls).toContainEqual({
      method: "POST",
      path: "/auth/change-password",
      body: { current_password: "pociatocne", new_password: "nove-heslo-1" },
    });
  });

  it("new passwords that differ are said before anything is sent", async () => {
    const { calls } = renderApp({ user: { ...ADMIN, must_change_password: true } });

    await screen.findByRole("heading", { name: "Nastav si vlastné heslo" });
    typeInto("Súčasné heslo", "pociatocne");
    typeInto("Nové heslo", "nove-heslo-1");
    typeInto("Zopakuj nové heslo", "nove-heslo-2");
    fireEvent.click(screen.getByRole("button", { name: "Nastaviť heslo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Nové heslá sa nezhodujú.");
    expect(calls.filter((c) => c.path === "/auth/change-password")).toEqual([]);
  });

  it("a refused password change says the server's sentence", async () => {
    renderApp({
      user: { ...ADMIN, must_change_password: true },
      answers: { "POST /auth/change-password": new ApiError(422, "Súčasné heslo je nesprávne.", {}) },
    });

    await screen.findByRole("heading", { name: "Nastav si vlastné heslo" });
    typeInto("Súčasné heslo", "zle");
    typeInto("Nové heslo", "nove-heslo-1");
    typeInto("Zopakuj nové heslo", "nove-heslo-1");
    fireEvent.click(screen.getByRole("button", { name: "Nastaviť heslo" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Súčasné heslo je nesprávne.");
  });

  it("a server that does not answer is said, and asked again on request", async () => {
    let up = false;
    renderApp({
      answers: {
        "GET /auth/me": () => {
          if (!up) throw new ApiError(502, "Bad Gateway", null);
          return ADMIN;
        },
      },
    });

    expect(await screen.findByText("Aplikácia teraz neodpovedá. Skús to o chvíľu znova.")).toBeInTheDocument();
    up = true;
    fireEvent.click(screen.getByRole("button", { name: "Skúsiť znova" }));

    await frame();
  });
});

describe("with the real client of nex-shared", () => {
  const manifest = defineApp({ ...BASE, nav: [{ label: "Oblasti", path: "/areas", icon: "🗂️" }] });
  // The app's own page, with its own client, as an app on the template has it.
  const appClient = createApiClient({ baseUrl: "", apiPrefix: "/api/v1", getToken: () => null });
  function Areas() {
    return <Button onClick={() => void appClient.get("/areas").catch(() => undefined)}>Načítať oblasti</Button>;
  }

  function serve(signedIn: { value: boolean }) {
    const requests: { url: string; credentials?: RequestCredentials }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
      requests.push({ url, credentials: init.credentials });
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
      if (!signedIn.value) return json(401, { detail: "Nie si prihlásený.", code: "KIT-AUTH-REQUIRED" });
      if (url === "/api/v1/auth/me") return json(200, ADMIN);
      if (url === "/api/v1/health") return json(200, { status: "ok", version: "0.1.0" });
      if (url === "/api/v1/user-layout")
        return json(200, { sidebar_width: null, sidebar_collapsed: false, limits: { sidebar_width: { min: 180, max: 360, default: 224 } } });
      return json(200, []);
    });
    return requests;
  }

  afterEach(() => vi.unstubAllGlobals());

  it("asks the same address with the session cookie", async () => {
    const requests = serve({ value: true });
    render(
      <MemoryRouter>
        <TemplateApp manifest={manifest} overview={<p>Obsah prehľadu</p>} />
      </MemoryRouter>,
    );

    await frame();
    expect(requests[0]).toEqual({ url: "/api/v1/auth/me", credentials: "same-origin" });
  });

  it("a 401 while working sends the person back to signing in, saying why", async () => {
    const signedIn = { value: true };
    serve(signedIn);
    render(
      <MemoryRouter initialEntries={["/areas"]}>
        <TemplateApp manifest={manifest} overview={<p>Obsah prehľadu</p>}>
          <Route path="/areas" element={<Areas />} />
        </TemplateApp>
      </MemoryRouter>,
    );
    await frame();

    signedIn.value = false;
    fireEvent.click(await screen.findByRole("button", { name: "Načítať oblasti" }));

    expect(await screen.findByText("Prihlásenie vypršalo. Prihlás sa znova.")).toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("aside")).toBeNull());
    expect(UNAUTHORIZED.status).toBe(401);
  });
});
