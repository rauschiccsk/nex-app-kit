// DEV-311 — a change of the signed-in person shows everywhere at once, wherever it was made. 05.11.2026, NEX Manager
// 1.5.3: the admin changed his own e-mail in Používatelia and Moje konto kept the old one until the page was reloaded —
// the frame holds a copy of the person and only Moje konto's own save refreshed it. The Director: „Takto systém nikto
// nebude používať … prosím raz a navždy zabezpečiť, aby nič také už viackrát sa nestalo.“ The frame listens to the
// changes the client of nex-shared tells (onServerChange) — walked here with that real client.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MyAccountPanel } from "nex-shared";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defineApp } from "../src/manifest";
import { TemplateApp } from "../src/TemplateApp";
import { ADMIN, BASE, LAYOUT, PLAIN_USER, frame } from "./helpers";

const EVA = { ...PLAIN_USER };

/** A server with the admin and Eva; returns how often the frame asked who is signed in. */
function serve() {
  const people = new Map([
    [ADMIN.id, { ...ADMIN }],
    [EVA.id, { ...EVA }],
  ]);
  const asked = { me: 0 };
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.replace(/^\/api\/v1/, "");
    const json = (status: number, body: unknown) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    const changed = (id: string) => {
      const next = { ...people.get(id)!, ...(JSON.parse(String(init.body)) as object) };
      people.set(id, next);
      return json(200, next);
    };
    if (method === "GET" && path === "/auth/me") {
      asked.me += 1;
      return json(200, people.get(ADMIN.id));
    }
    if (method === "PATCH" && path === "/auth/me") return changed(ADMIN.id);
    const user = /^\/users\/([^/]+)$/.exec(path);
    if (method === "PATCH" && user?.[1]) return changed(user[1]);
    if (path === "/users") return json(200, [...people.values()]);
    if (path === "/user-layout") return json(200, LAYOUT);
    if (path === "/health") return json(200, { status: "ok", version: "0.1.0" });
    return json(200, []);
  });
  return asked;
}

function renderSettings() {
  render(
    <MemoryRouter initialEntries={["/settings"]}>
      <TemplateApp manifest={defineApp(BASE)} overview={<p>Obsah prehľadu</p>} />
    </MemoryRouter>,
  );
}

async function editRow(username: string, changes: { email?: string; first_name?: string }) {
  fireEvent.click(await screen.findByRole("tab", { name: "Používatelia" }));
  const table = await screen.findByRole("table");
  const row = (await within(table).findByText(username)).closest("tr") as HTMLElement;
  fireEvent.click(within(row).getByTitle("Upraviť"));
  if (changes.email) fireEvent.change(screen.getByLabelText("Email *"), { target: { value: changes.email } });
  if (changes.first_name) fireEvent.change(screen.getByLabelText("Meno"), { target: { value: changes.first_name } });
  fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("the signed-in person changed elsewhere (DEV-311)", () => {
  it("own row changed in Používatelia shows in Moje konto and the left panel without reloading", async () => {
    serve();
    renderSettings();
    const { aside } = await frame();

    await editRow(ADMIN.username, { email: "jan.novy@firma.sk", first_name: "Jano" });

    expect(await within(aside).findByText("Jano Novák")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Moje konto" }));
    await waitFor(() => expect(screen.getByLabelText("Email *")).toHaveValue("jan.novy@firma.sk"));
    expect(screen.getByLabelText("Meno")).toHaveValue("Jano");
  });

  it("another person changed in Používatelia leaves the signed-in one as it is, without asking again", async () => {
    const asked = serve();
    renderSettings();
    const { aside } = await frame();

    await editRow(EVA.username, { first_name: "Evka" });

    expect(await screen.findByText("Evka Malá")).toBeInTheDocument();
    expect(within(aside).getByText("Ján Novák")).toBeInTheDocument();
    expect(asked.me).toBe(1);
  });
});

describe("Moje konto follows the person (DEV-311)", () => {
  it("shows the new data when the person changes, not the copy it first appeared with", () => {
    const props = { roleLabel: "Správca", onSaveProfile: async () => {}, onChangePassword: async () => {}, telegram: false };
    const { rerender } = render(<MyAccountPanel user={ADMIN} {...props} />);

    rerender(<MyAccountPanel user={{ ...ADMIN, email: "jan.novy@firma.sk", first_name: "Jano" }} {...props} />);

    expect(screen.getByLabelText("Email *")).toHaveValue("jan.novy@firma.sk");
    expect(screen.getByLabelText("Meno")).toHaveValue("Jano");
  });
});
