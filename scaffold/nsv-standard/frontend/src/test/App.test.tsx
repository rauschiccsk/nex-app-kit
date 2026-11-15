// The app opens with the template's frame: signed in (here: the preview's answers instead of a server), the left
// panel with the template's entries, the overview of the app.
import { render, screen } from "@testing-library/react";
import { setupServer } from "msw/node";
import { createApiClient, createTranslator } from "nex-shared";
import { mergeMessages } from "nex-app-kit";
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

    // In the app's main language (DEV-394): the preview's person chose none, the installation says none.
    const t = createTranslator(manifest.languages[0] ?? "sk", mergeMessages(manifest.messages));
    expect(await screen.findByRole("heading", { name: t("kit.place.overview") })).toBeInTheDocument();
    for (const entry of ["kit.place.gettingStarted", "kit.place.updates", "kit.place.settings"]) {
      expect(screen.getByRole("button", { name: t(entry) })).toBeInTheDocument();
    }
    expect(screen.getAllByText(manifest.name).length).toBeGreaterThan(0);
  });
});
