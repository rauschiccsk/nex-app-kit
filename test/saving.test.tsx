// DEV-520 — every app on the template saves a form the same way: Uložiť and Zrušiť only after a change, never
// „Uložené“ by the button, and „✓ …uložené“ green at the top right. 26.11.2026 NEX HelpDesk (Asistent → Telefón) said
// „Uložené.“ by the button after a change that was not saved. The Director: „Chcel by som aby formuláre vo všetkých
// aplikáciách boli ošetrené rovnako.“ The click path a server-side render cannot take: a real save shows the notice.
import { act, fireEvent, screen } from "@testing-library/react";
import { announceSaved } from "nex-shared";

import { ADMIN, renderApp } from "./helpers";

function notice(text: string): HTMLElement {
  const region = screen.getByText(text).closest("[aria-live]") as HTMLElement;
  expect(region).not.toBeNull();
  return region;
}

describe("saving a form (DEV-520)", () => {
  it("the frame of every app has the place at the top right", async () => {
    renderApp({ path: "/" });
    await screen.findByText("Obsah prehľadu");

    act(() => announceSaved());

    // The notice subscribes to the store after its first paint; an announcement right after mounting shows a moment
    // later (it reads the store as it subscribes) — so wait for it.
    await screen.findByText("Uložené");
    const region = notice("Uložené");
    expect(region.className).toMatch(/fixed/);
    expect(region.className).toMatch(/top-4/);
    expect(region.className).toMatch(/right-4/);
    expect(region).toHaveTextContent(/^✓\s*Uložené$/);
  });

  it("Moje konto: Uložiť and Zrušiť wait for a change, Zrušiť drops it, a save is said at the top right", async () => {
    const { calls } = renderApp({ path: "/settings", user: ADMIN, answers: { "PATCH /auth/me": (body: unknown) => ({ ...ADMIN, ...(body as object) }) } });
    fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));
    const save = screen.getByRole("button", { name: "Uložiť" });
    const cancel = screen.getAllByRole("button", { name: "Zrušiť" })[0];
    const name = screen.getByLabelText("Meno") as HTMLInputElement;

    expect(save).toBeDisabled();
    expect(cancel).toBeDisabled();
    // „Uložené“ is said only at the top right — nowhere by the buttons.
    expect(screen.queryAllByText(/Uložené/).filter((el) => !el.closest("[aria-live]"))).toHaveLength(0);

    fireEvent.change(name, { target: { value: "Jano" } });
    expect(save).toBeEnabled();
    fireEvent.click(cancel);
    expect(name.value).toBe("Ján");
    expect(save).toBeDisabled();

    fireEvent.change(name, { target: { value: "Jano" } });
    fireEvent.click(save);

    expect(await screen.findByText("Údaje boli uložené.")).toBeInTheDocument();
    expect(notice("Údaje boli uložené.")).toHaveTextContent(/^✓\s*Údaje boli uložené\.$/);
    expect(save).toBeDisabled();
    expect(calls.filter((c) => c.method === "PATCH" && c.path === "/auth/me")).toHaveLength(1);
  });
});
