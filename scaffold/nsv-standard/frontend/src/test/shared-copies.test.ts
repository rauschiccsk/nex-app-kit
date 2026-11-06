// DEV-311 — every shared store of the app that loads from the server refreshes itself after a change (`KONTRAKT.md` of
// nex-app-kit, „Údaje na viacerých obrazovkách“). The Director 05.11.2026: make sure, once and for all, that this never
// happens again, neither in the cockpit nor in our apps.
import { describe, expect, it } from "vitest";

import { storesWithoutChangeListener } from "./sharedCopies";

/** The app's own code — every module under src/ but the tests, as text. */
const SOURCES = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../test/**"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("shared copies of server data", () => {
  it("every shared store that loads from the server listens to its changes", () => {
    const files = Object.entries(SOURCES).map(([path, text]) => ({ path: path.replace(/^\.\.\//, ""), text }));

    expect(files.map((f) => f.path)).toContain("App.tsx"); // the guard reads the app's code, not an empty list
    expect(storesWithoutChangeListener(files)).toEqual([]);
  });
});
