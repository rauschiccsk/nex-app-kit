// DEV-377 — an installation says whom it serves and whether it is the test or the live one.
// 13.11.2026 the Director ran NEX Manager and could not tell for whom: the window, its header and the icon on the task
// bar all read „NEX Manager“, and ICC s.r.o. and MÁGERSTAV s.r.o. each have one on UAT and on PROD. The cockpit writes
// the customer and the environment into every installation; the frame says them. Director, on the proposal (translated):
// "I agree, I will try it and we will see."
import { screen, waitFor } from "@testing-library/react";

import { INSTALLATION_MANIFEST, installationTitle } from "../src/frame/installation";
import { frame, renderApp } from "./helpers";

const MAGER_UAT = { "GET /installation": { customer: "MÁGERSTAV s.r.o.", environment: "uat" } };
const ICC_PROD = { "GET /installation": { customer: "ICC s.r.o.", environment: "prod" } };

function manifestLink(): string | null {
  return document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute("href") ?? null;
}

beforeEach(() => {
  document.title = "NEX Skúška";
  document.head.querySelectorAll('link[rel="manifest"]').forEach((l) => l.remove());
  const link = document.createElement("link");
  link.rel = "manifest";
  link.href = "/manifest.webmanifest";
  document.head.appendChild(link);
});

describe("whom the installation serves (DEV-377)", () => {
  it.each([
    [{ customer: "MÁGERSTAV s.r.o.", environment: "uat" }, "NEX Manager — MÁGERSTAV s.r.o. (UAT)"],
    [{ customer: "ICC s.r.o.", environment: "prod" }, "NEX Manager — ICC s.r.o."],
    [{ customer: null, environment: "uat" }, "NEX Manager (UAT)"],
    [{ customer: null, environment: null }, "NEX Manager"],
  ] as const)("the title says %o as the server names the installed app", (installation, title) => {
    expect(installationTitle("NEX Manager", installation)).toBe(title);
  });

  it("a UAT carries a band over every page, the panel names the customer, the window and the installed app too", async () => {
    renderApp({ answers: MAGER_UAT });
    const { aside } = await frame();

    expect(await screen.findByRole("status")).toHaveTextContent("Skúšobné prostredie (UAT) — MÁGERSTAV s.r.o.");
    expect(aside).toHaveTextContent("MÁGERSTAV s.r.o.");
    await waitFor(() => expect(document.title).toBe("NEX Knowledge — MÁGERSTAV s.r.o. (UAT)"));
    expect(manifestLink()).toBe(INSTALLATION_MANIFEST);
  });

  it("a PROD names its customer and carries no band", async () => {
    renderApp({ answers: ICC_PROD });
    const { aside } = await frame();

    await waitFor(() => expect(aside).toHaveTextContent("ICC s.r.o."));
    expect(screen.queryByText(/Skúšobné prostredie/)).toBeNull();
    expect(document.title).toBe("NEX Knowledge — ICC s.r.o.");
    expect(manifestLink()).toBe(INSTALLATION_MANIFEST);
  });

  it("an app outside the cockpit looks as before", async () => {
    renderApp();
    await frame();
    await screen.findByText("Obsah prehľadu");

    expect(screen.queryByText(/Skúšobné prostredie/)).toBeNull();
    expect(document.title).toBe("NEX Knowledge");
    expect(manifestLink()).toBe("/manifest.webmanifest");
  });

  it("the sign-in card says whose installation it is and that it is a test one, before the password goes in", async () => {
    renderApp({ user: null, answers: MAGER_UAT });

    expect(await screen.findByText("MÁGERSTAV s.r.o.")).toBeInTheDocument();
    expect(screen.getByText("Skúšobné prostredie (UAT)")).toBeInTheDocument();
  });
});
