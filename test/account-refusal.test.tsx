// DEV-309 — Moje konto says why the server refused. 05.11.2026, NEX Manager 1.5.1 on this template: the server said
// „Tento e-mail už používa iný používateľ.“ (409) and the person read „Uloženie zlyhalo. Skús to znova.“; a refused
// password said „skontroluj súčasné heslo“ whatever the reason. The server's sentences are the template's own
// (KONTRAKT.md, errors.py: {"detail": "<sentence>", "code": "KIT-…"}).
import { fireEvent, screen } from "@testing-library/react";
import { ApiError } from "nex-shared";

import { ADMIN, renderApp } from "./helpers";

const TAKEN = "Tento e-mail už používa iný používateľ.";
const WRONG = "Súčasné heslo je nesprávne.";

async function openAccount(answers: Record<string, unknown>) {
  renderApp({ path: "/settings", user: ADMIN, answers });
  fireEvent.click(await screen.findByRole("tab", { name: "Moje konto" }));
}

describe("Moje konto — the server's reason (DEV-309)", () => {
  it("a refused profile shows the server's sentence", async () => {
    await openAccount({ "PATCH /auth/me": new ApiError(409, TAKEN, { detail: TAKEN, code: "KIT-EMAIL-TAKEN" }) });

    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "eva@firma.sk" } });
    fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));

    expect(await screen.findByText(TAKEN)).toBeInTheDocument();
    expect(screen.queryByText("Uloženie zlyhalo. Skús to znova.")).not.toBeInTheDocument();
  });

  it("a refused password shows the server's sentence", async () => {
    await openAccount({
      "POST /auth/change-password": new ApiError(422, WRONG, { detail: WRONG, code: "KIT-PASSWORD-WRONG" }),
    });

    fireEvent.change(screen.getByLabelText("Súčasné heslo"), { target: { value: "zle-heslo" } });
    fireEvent.change(screen.getByLabelText("Nové heslo"), { target: { value: "nove-heslo" } });
    fireEvent.change(screen.getByLabelText("Zopakuj nové heslo"), { target: { value: "nove-heslo" } });
    fireEvent.click(screen.getByRole("button", { name: "Zmeniť heslo" }));

    expect(await screen.findByText(WRONG)).toBeInTheDocument();
  });

  it("without the server's sentence the panel says its own and guesses no reason", async () => {
    await openAccount({
      "PATCH /auth/me": new TypeError("Failed to fetch"),
      "POST /auth/change-password": new ApiError(500, "Internal Server Error", null),
    });

    fireEvent.click(screen.getByRole("button", { name: "Uložiť" }));
    expect(await screen.findByText("Uloženie zlyhalo. Skús to znova.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Súčasné heslo"), { target: { value: "stare" } });
    fireEvent.change(screen.getByLabelText("Nové heslo"), { target: { value: "nove" } });
    fireEvent.change(screen.getByLabelText("Zopakuj nové heslo"), { target: { value: "nove" } });
    fireEvent.click(screen.getByRole("button", { name: "Zmeniť heslo" }));
    expect(await screen.findByText("Zmena hesla zlyhala. Skús to znova.")).toBeInTheDocument();
  });
});
