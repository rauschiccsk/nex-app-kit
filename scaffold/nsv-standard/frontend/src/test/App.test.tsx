// The app opens with the template's frame: signed in (here: the preview's answers instead of a server), the left
// panel with the template's entries, the overview of the app.
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { createApiClient } from "nex-shared";
import { previewHandlers } from "nex-app-kit/preview";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { App } from "../App";
import { manifest } from "../app";

const server = setupServer(...previewHandlers({ manifest }));
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("App", () => {
  it("opens with the template's frame and the app's overview", async () => {
    render(<App client={createApiClient({ baseUrl: "http://localhost", apiPrefix: "/api/v1", getToken: () => null })} />);

    expect(await screen.findByRole("heading", { name: "Prehľad" })).toBeInTheDocument();
    for (const entry of ["Ako začať", "Aktualizácie", "Nastavenia"]) {
      expect(screen.getByRole("button", { name: entry })).toBeInTheDocument();
    }
    expect(screen.getAllByText(manifest.name).length).toBeGreaterThan(0);
  });
});
