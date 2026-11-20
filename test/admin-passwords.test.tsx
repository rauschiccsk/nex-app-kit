// DEV-439 — passwords and the admin in the template's frame. 20.11.2026 in Orthodox Hermenia the admin renamed
// themselves in Používatelia; the browser had filled their saved password into the empty password field and the save
// was refused („Svoje heslo si zmeň v Moje konto.“). The Director: the admin sets anyone's password, their own too —
// another's is an initial one, their own a regular one; their own account has an eye at the password, another's has
// none; Moje konto asks no current password and has the eye for everyone; the admin is never offered for deletion.
// An eye shows only what is typed: „tam kde heslo sa nedá zobraziť netreba zobraziť ani oko“.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { ADMIN, PLAIN_USER, renderApp } from "./helpers";

const OTHER_ADMIN = { ...ADMIN, id: "u3", username: "peter", email: "peter@firma.sk", first_name: "Peter", last_name: "Veľký" };
const EVA = { ...PLAIN_USER, email: "eva@firma.sk" };
const PEOPLE = [ADMIN, EVA, OTHER_ADMIN];

async function openUsers() {
  const app = renderApp({ path: "/settings", user: ADMIN, answers: { "GET /users": PEOPLE } });
  fireEvent.click(await screen.findByRole("tab", { name: "Používatelia" }));
  await screen.findByText("peter@firma.sk");
  return app;
}

function row(email: string) {
  return screen.getByText(email).closest("tr") as HTMLElement;
}

describe("Používatelia — the admin and passwords (DEV-439)", () => {
  it("one's own row offers no delete and no deactivation; another admin is not offered for deletion", async () => {
    await openUsers();

    const offers = (email: string) => ({
      delete: within(row(email)).queryByTitle("Vymazať") !== null,
      toggle: within(row(email)).queryByRole("button", { name: /Deaktivovať|Aktivovať/ }) !== null,
      edit: within(row(email)).queryByTitle("Upraviť") !== null,
    });
    expect(offers("jan@firma.sk")).toEqual({ delete: false, toggle: false, edit: true });
    expect(offers("peter@firma.sk")).toEqual({ delete: false, toggle: true, edit: true });
    expect(offers("eva@firma.sk")).toEqual({ delete: true, toggle: true, edit: true });
  });

  it("the admin's own password has the eye, it shows what is typed and hides it again", async () => {
    await openUsers();
    fireEvent.click(within(row("jan@firma.sk")).getByTitle("Upraviť"));

    const field = screen.getByLabelText(/^Nové heslo/);
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
    fireEvent.change(field, { target: { value: "moje-nove" } });
    fireEvent.click(screen.getByRole("button", { name: "Zobraziť: Nové heslo" }));
    expect(field).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Skryť: Nové heslo" }));
    expect(field).toHaveAttribute("type", "password");
  });

  it("another person's password has no eye — the admin only gives a new initial password", async () => {
    await openUsers();
    fireEvent.click(within(row("eva@firma.sk")).getByTitle("Upraviť"));

    expect(screen.getByLabelText(/^Nové heslo/)).toHaveAttribute("autocomplete", "new-password");
    expect(screen.queryByRole("button", { name: /^Zobraziť/ })).toBeNull();
  });

  it("the admin renames themselves without touching the password — only the name is sent", async () => {
    const { calls } = await openUsers();
    fireEvent.click(within(row("jan@firma.sk")).getByTitle("Upraviť"));

    fireEvent.change(screen.getByLabelText(/^Meno/), { target: { value: "Administrátor" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));

    await waitFor(() => expect(calls.some((c) => c.method === "PATCH" && c.path === "/users/u1")).toBe(true));
    expect(calls.filter((c) => c.path.endsWith("/password"))).toEqual([]);
  });

  it("the admin's own new password goes to the server like anyone's", async () => {
    const { calls } = await openUsers();
    fireEvent.click(within(row("jan@firma.sk")).getByTitle("Upraviť"));

    fireEvent.change(screen.getByLabelText(/^Nové heslo/), { target: { value: "moje-nove" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));

    await waitFor(() =>
      expect(calls).toContainEqual({ method: "POST", path: "/users/u1/password", body: { new_password: "moje-nove" } }),
    );
  });
});

describe("Moje konto and the first password — no current password, an eye for everyone (DEV-439)", () => {
  it("Moje konto asks no current password; the eye shows the new one", async () => {
    renderApp({ path: "/settings", user: EVA });
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));

    expect(screen.queryByLabelText("Súčasné heslo")).toBeNull();
    const field = screen.getByLabelText("Nové heslo");
    fireEvent.change(field, { target: { value: "nove" } });
    fireEvent.click(screen.getByRole("button", { name: "Zobraziť: Nové heslo" }));
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Zobraziť: Zopakuj nové heslo" })).toBeInTheDocument();
  });

  it("the first password of a person is chosen without the one from the admin, with the eye", async () => {
    renderApp({ user: { ...EVA, must_change_password: true } });

    await screen.findByRole("heading", { name: "Nastav si vlastné heslo" });
    expect(screen.queryByLabelText("Súčasné heslo")).toBeNull();
    expect(screen.getByRole("button", { name: "Zobraziť: Nové heslo" })).toBeInTheDocument();
  });
});
