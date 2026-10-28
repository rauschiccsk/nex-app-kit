// DEV-251 — Nastavenia of the template: Systém, Moje konto, Používatelia (admin), Agenti (AI), Relácie. Director
// 28.10.2026: „V nastaveniach … Systém, Moje konto, Používatelia (pre admin rolu), Agenty (ak aplikácia používa AI
// a Relácie“. An app launched from NEX Manager has its users there (DEV-250 B5): no Používatelia, an account to read.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { STANDARD_ENDPOINTS } from "../src/standard-api";
import { ADMIN, PLAIN_USER, renderApp, type Call } from "./helpers";

const AI = { roles: [{ id: "assistant", label: "Asistent" }] };

async function tabs(): Promise<string[]> {
  const list = await screen.findByRole("tablist");
  return within(list)
    .getAllByRole("tab")
    .map((t) => t.textContent ?? "");
}

describe("settings tabs", () => {
  it("own password, AI, admin: all five, in the cockpit's order", async () => {
    renderApp({ path: "/settings", manifest: { auth: "password", ai: AI }, user: ADMIN });

    expect(await tabs()).toEqual(["Systém", "Agenti", "Moje konto", "Používatelia", "Relácie"]);
  });

  it("a user sees neither Používatelia nor Agenti", async () => {
    renderApp({ path: "/settings", manifest: { auth: "password", ai: AI }, user: PLAIN_USER });

    expect(await tabs()).toEqual(["Systém", "Moje konto", "Relácie"]);
  });

  it("an app without AI has no Agenti", async () => {
    renderApp({ path: "/settings", manifest: { auth: "password" }, user: ADMIN });

    expect(await tabs()).toEqual(["Systém", "Moje konto", "Používatelia", "Relácie"]);
  });

  it("launched from NEX Manager: no Používatelia — they live in NEX Manager", async () => {
    renderApp({ path: "/settings", manifest: { auth: "manager", ai: AI }, user: ADMIN });

    expect(await tabs()).toEqual(["Systém", "Agenti", "Moje konto", "Relácie"]);
  });
});

describe("Systém", () => {
  const SETTING = {
    key: "search_limit",
    value: "20",
    value_type: "int",
    description: "Koľko výsledkov ukáže hľadanie.",
    label: "Počet výsledkov",
    updated_at: null,
    updated_by: null,
    updated_by_username: null,
    is_default: true,
  };

  it("groups the app's settings under the manifest's categories", async () => {
    renderApp({
      path: "/settings",
      manifest: { settings: { categories: [{ id: "search", label: "Hľadanie", description: "Kvalita hľadania.", prefixes: ["search_"] }] } },
      answers: { "GET /system-settings": [SETTING] },
    });

    expect(await screen.findByText("Počet výsledkov")).toBeInTheDocument();
    expect(screen.getByText("Hľadanie")).toBeInTheDocument();
  });
});

describe("Moje konto", () => {
  it("with its own password: name and e-mail are changed here, without a Telegram field", async () => {
    const { calls } = renderApp({
      path: "/settings",
      user: ADMIN,
      answers: { "PATCH /auth/me": (body: unknown) => ({ ...ADMIN, ...(body as object) }) },
    });
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));

    expect(screen.queryByText(/Telegram/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Meno"), { target: { value: "Jano" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "PATCH",
        path: "/auth/me",
        body: { email: "jan@firma.sk", first_name: "Jano", last_name: "Novák" },
      }),
    );
    // the footer names the person as they are now
    expect(await within(document.querySelector("aside") as HTMLElement).findByText("Jano Novák")).toBeInTheDocument();
  });

  it("with its own password: the password is changed through the standard interface", async () => {
    const { calls } = renderApp({ path: "/settings", user: ADMIN });
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));

    fireEvent.change(screen.getByLabelText("Súčasné heslo"), { target: { value: "stare-heslo" } });
    fireEvent.change(screen.getByLabelText("Nové heslo"), { target: { value: "nove-heslo-1" } });
    fireEvent.change(screen.getByLabelText("Zopakuj nové heslo"), { target: { value: "nove-heslo-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Zmeniť heslo" }));

    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        path: "/auth/change-password",
        body: { current_password: "stare-heslo", new_password: "nove-heslo-1" },
      }),
    );
  });

  it("launched from NEX Manager: the account is shown, changed in NEX Manager", async () => {
    renderApp({ path: "/settings", manifest: { auth: "manager" }, user: ADMIN });
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));

    expect(screen.getByText("Tvoj účet spravuje NEX Manager — meno, e-mail aj heslo sa menia tam.")).toBeInTheDocument();
    expect(screen.getByText("jan@firma.sk")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zmeniť heslo" })).not.toBeInTheDocument();
  });
});

describe("Používatelia", () => {
  it("lists the app's users", async () => {
    renderApp({ path: "/settings", user: ADMIN, answers: { "GET /users": [ADMIN, PLAIN_USER] } });
    fireEvent.click(await screen.findByRole("tab", { name: "Používatelia" }));

    expect(await screen.findByText("eva")).toBeInTheDocument();
  });
});

describe("Agenti", () => {
  it("one row for each agent role of the manifest, saved through the standard interface", async () => {
    renderApp({
      path: "/settings",
      manifest: { ai: AI },
      user: ADMIN,
      answers: {
        "GET /agent-settings": [{ role: "assistant", model: "sonnet", effort: "high" }],
        "GET /agent-settings/models": [{ id: "sonnet", label: "Sonnet" }, { id: "opus", label: "Opus" }],
      },
    });
    fireEvent.click(await screen.findByRole("tab", { name: "Agenti" }));

    expect(await screen.findByText("Asistent")).toBeInTheDocument();
  });
});

describe("the frame asks only what the app has (KONTRAKT.md, column „kedy“)", () => {
  function endpointOf(call: Call) {
    return STANDARD_ENDPOINTS.find(
      (e) =>
        e.method === call.method &&
        new RegExp(`^${e.path.replace(/\{\w+\}/g, "[^/]+")}$`).test(call.path),
    );
  }

  async function visitEverything(manifest: object, user = ADMIN) {
    const { calls } = renderApp({ path: "/settings", manifest, user });
    for (const name of await tabs()) {
      fireEvent.click(screen.getByRole("tab", { name }));
      await screen.findByRole("tab", { name, selected: true });
    }
    for (const entry of ["Prehľad", "Ako začať", "Aktualizácie"]) {
      fireEvent.click(screen.getByRole("button", { name: entry }));
    }
    await waitFor(() => expect(calls.some((c) => c.path === "/release-notes")).toBe(true));
    return calls;
  }

  it("launched from NEX Manager, without AI: no call needs its own password or agents", async () => {
    const calls = await visitEverything({ auth: "manager" });

    const scopes = calls.map((c) => endpointOf(c)?.scope ?? `mimo rozhrania: ${c.method} ${c.path}`);
    expect(new Set(scopes)).toEqual(new Set(["always"]));
  });

  it("with its own password and AI: every call is in the standard interface", async () => {
    const calls = await visitEverything({ auth: "password", ai: AI });

    expect(calls.filter((c) => !endpointOf(c))).toEqual([]);
    expect(new Set(calls.map((c) => endpointOf(c)?.scope))).toEqual(new Set(["always", "password", "ai"]));
  });
});

describe("the kit's own settings and sessions (DEV-252)", () => {
  it("the session's times stand under „Prihlásenie“", async () => {
    renderApp({
      path: "/settings",
      answers: {
        "GET /system-settings": [
          {
            key: "auth_session_idle_minutes",
            value: "480",
            value_type: "int",
            description: "Po koľkých minútach bez práce aplikácia človeka odhlási.",
            label: "Odhlásenie po nečinnosti",
            unit: "minút",
            updated_at: null,
            updated_by: null,
            updated_by_username: null,
            is_default: true,
          },
        ],
      },
    });

    expect(await screen.findByText("Odhlásenie po nečinnosti")).toBeInTheDocument();
    expect(screen.getByText("Prihlásenie")).toBeInTheDocument();
    expect(screen.queryByText("Ostatné")).not.toBeInTheDocument();
  });

  it("Relácie name each person as the server's row does", async () => {
    renderApp({
      path: "/settings",
      answers: {
        "GET /sessions": [
          {
            id: "s1",
            user_id: "u9",
            username: "eva",
            created_at: "2026-10-28T08:00:00Z",
            last_seen_at: "2026-10-28T12:00:00Z",
            updated_at: "2026-10-28T12:00:00Z",
            expires_at: "2026-10-29T08:00:00Z",
            user_agent: "Firefox",
            current: false,
          },
        ],
      },
    });
    fireEvent.click(await screen.findByRole("tab", { name: "Relácie" }));

    expect(await screen.findByText("eva")).toBeInTheDocument();
    expect(screen.queryByText("u9")).not.toBeInTheDocument();
    expect(screen.getByText("Kto je prihlásený a odkedy. Zrušená relácia prestane platiť hneď.")).toBeInTheDocument();
  });
});
