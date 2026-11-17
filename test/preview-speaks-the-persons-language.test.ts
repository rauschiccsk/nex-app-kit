// @vitest-environment node
// DEV-421 — the Vizuál preview says the template's own settings in the language of the person signed in to it, as the
// server does. Since 0.14.0 (DEV-394) their names are keys of the server's catalogs; the preview has no server and
// passed the keys on — 17.11.2026 NEX Manager 1.7.0 showed „kit.setting.idle.label“ on Nastavenia → Systém in every
// language. Director: „Súhlasím“.
import { readFileSync, readdirSync } from "node:fs";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApiClient } from "nex-shared";

import { defineApp } from "../src/manifest";
import { SERVER_CATALOGS, previewHandlers } from "../src/preview";
import { createStandardApi } from "../src/standard-api";

const LOCALES = new URL("../server/src/nex_app_kit/locales/", import.meta.url);
/** The server's catalogs as the server reads them — from its files, not from the preview. */
const SERVER: Record<string, Record<string, string>> = Object.fromEntries(
  readdirSync(LOCALES)
    .filter((name) => name.endsWith(".json"))
    .map((name) => [name.replace(/\.json$/, ""), JSON.parse(readFileSync(new URL(name, LOCALES), "utf-8"))]),
);
const KEYS = new Set(Object.values(SERVER).flatMap((catalog) => Object.keys(catalog)));
/** The server's sentence of ``key`` in ``language`` — a missing one fails the test that asks for it. */
function said(language: string, key: string): string {
  const sentence = SERVER[language]?.[key];
  if (!sentence) throw new Error(`the server's ${language} catalog has no ${key}`);
  return sentence;
}

const APP = defineApp({ template: "nsv-standard", name: "NEX Skúška", initials: "NS", auth: "password", languages: ["sk", "hu", "en"] });
const server = setupServer();
const api = createStandardApi(createApiClient({ baseUrl: "http://nahlad.local", apiPrefix: "/api/v1", getToken: () => null }));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("the preview says the template's settings in the person's language", () => {
  it.each(["sk", "hu", "en"])("in %s — the names the server says, no key of its catalogs", async (language) => {
    server.use(...previewHandlers({ manifest: APP, user: { language } }));

    const rows = await api.listSystemSettings();
    const idle = rows.find((r) => r.key === "auth_session_idle_minutes");
    const words = rows.flatMap((r) => [r.label, r.description, r.unit, ...(r.choices ?? []).map((c) => c.label)]);

    expect(words.filter((w) => w && KEYS.has(w))).toEqual([]);
    expect([idle?.label, idle?.description, idle?.unit]).toEqual([
      said(language, "kit.setting.idle.label"),
      said(language, "kit.setting.idle.description"),
      said(language, "kit.setting.idle.unit"),
    ]);
  });

  it("a person who chose a language in the preview gets the names in it, the saved row too", async () => {
    server.use(...previewHandlers({ manifest: APP }));

    await api.setLanguage("hu");
    const saved = await api.updateSystemSetting("auth_session_max_hours", "12");

    expect([saved.label, saved.unit]).toEqual([said("hu", "kit.setting.maxHours.label"), said("hu", "kit.setting.maxHours.unit")]);
  });

  it("the preview knows every catalog of the server", () => {
    expect(Object.keys(SERVER_CATALOGS).sort()).toEqual(Object.keys(SERVER).sort());
  });
});
