// DEV-415 — what a multilingual app needed and built on its own until 0.16.0: the admin sets a person's language in
// Používatelia, and the page says which language it is in.
//
// 16.11.2026 the Specification of NEX Manager 1.7.0 planned a button „Jazyk: …“, two server routes and a store of its
// own for the first, and code of its own for the second. Every app on the template speaks Slovak, Hungarian and
// English by default. Director: „Súhlasím“.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ADMIN, frame, PLAIN_USER, renderApp } from "./helpers";

const THREE = { languages: ["sk", "hu", "en"] };
const INSTALLATION_HU = { customer: null, environment: null, language: "hu", languages: ["sk", "hu", "en"] };

afterEach(() => {
  document.documentElement.lang = "sk";
});

describe("the page says its language", () => {
  it("the person's language, as soon as the frame knows it", async () => {
    renderApp({ manifest: THREE, user: { ...ADMIN, language: "en" } });

    await frame();
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });

  it("on the sign-in the installation's", async () => {
    renderApp({ manifest: THREE, user: null, answers: { "GET /installation": INSTALLATION_HU } });

    await screen.findByRole("button", { name: "Bejelentkezés" });
    expect(document.documentElement.lang).toBe("hu");
  });

  it("it changes with the language chosen in Moje konto", async () => {
    renderApp({
      manifest: THREE,
      path: "/settings",
      answers: { "PUT /auth/language": (body: unknown) => ({ ...ADMIN, ...(body as object) }) },
    });
    await frame();
    expect(document.documentElement.lang).toBe("sk");
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));

    fireEvent.change(await screen.findByRole("combobox", { name: "Jazyk" }), { target: { value: "hu" } });

    await waitFor(() => expect(document.documentElement.lang).toBe("hu"));
  });
});

describe("the admin sets a person's language in Používatelia", () => {
  // jan chose Slovak, eva English, ota nothing
  const ME = { ...ADMIN, language: "sk" };
  const PEOPLE = [ME, { ...PLAIN_USER, language: "en" }, { ...PLAIN_USER, id: "u3", username: "ota", language: null }];

  async function users(options: { manifest?: object; installation?: object } = {}) {
    const rendered = renderApp({
      manifest: options.manifest ?? THREE,
      user: ME,
      path: "/settings",
      answers: {
        "GET /users": PEOPLE,
        "PATCH /users/u2": (body: unknown) => ({ ...PEOPLE[1], ...(body as object) }),
        ...(options.installation ? { "GET /installation": options.installation } : {}),
      },
    });
    fireEvent.click(await screen.findByRole("tab", { name: "Používatelia" }));
    await screen.findByText("eva");
    return rendered;
  }

  const languageOf = (username: string) => {
    // the person's row of the table — „Prihlásený ako jan“ above it names the admin too
    const row = screen.getAllByText(username).map((e) => e.closest("tr")).find(Boolean) as HTMLElement;
    return within(row).getAllByRole("cell").map((c) => c.textContent);
  };

  it("every person's language stands in the list — whoever chose none has the installation's", async () => {
    await users({ installation: INSTALLATION_HU });

    expect(screen.getByRole("columnheader", { name: "Jazyk" })).toBeInTheDocument();
    expect(languageOf("jan")).toContain("Slovenčina");
    expect(languageOf("eva")).toContain("English");
    expect(languageOf("ota")).toContain("Magyar");
  });

  it("the admin changes it in the person's form and only the change is sent", async () => {
    const { calls } = await users();
    const editEva = () => fireEvent.click(within(screen.getByText("eva").closest("tr") as HTMLElement).getByTitle("Upraviť"));

    editEva();
    fireEvent.click(await screen.findByRole("button", { name: "Uložiť" }));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
    editEva();
    fireEvent.change(await screen.findByLabelText("Jazyk"), { target: { value: "hu" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));

    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2));
    const [unchanged, changed] = calls
      .filter((c) => c.method === "PATCH")
      .map((c) => c.body as Record<string, unknown>) as [Record<string, unknown>, Record<string, unknown>];
    expect("language" in unchanged).toBe(false);
    expect(changed.language).toBe("hu");
  });

  it("an app with one language shows no language in Používatelia", async () => {
    await users({ manifest: {} });

    expect(screen.queryByRole("columnheader", { name: "Jazyk" })).toBeNull();
  });
});
