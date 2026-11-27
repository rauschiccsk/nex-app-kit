// The web opens with the template's frame: signed in (here: the preview's answers instead of a server), the top bar
// with the person and „Odhlásiť sa“, and the web's first page.
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

describe("web", () => {
  it("opens with the template's frame of the web and its first page", async () => {
    render(<App client={createApiClient({ baseUrl: "http://localhost", apiPrefix: "/api/v1", getToken: () => null })} />);

    const t = createTranslator(manifest.languages[0] ?? "sk", mergeMessages(manifest.messages));
    expect(await screen.findByRole("heading", { name: t("app.web.home.title") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("kit.web.signOut") })).toBeInTheDocument();
    expect(screen.getAllByText(manifest.name).length).toBeGreaterThan(0);
  });
});
