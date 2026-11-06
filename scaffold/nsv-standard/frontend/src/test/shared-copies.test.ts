// DEV-311, DEV-316 — every shared store of the app refreshes itself after a change on the server, or says in one line
// why it needs not (`KONTRAKT.md` of nex-app-kit, „Údaje na viacerých obrazovkách“). The Director 05.11.2026: make sure,
// once and for all, that this never happens again, neither in the cockpit nor in our apps.
import { describe, expect, it } from "vitest";

import { storesThatDoNotFollowTheServer } from "./sharedCopies";

/** The app's own code — every module under src/ but the tests, as text. */
const SOURCES = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../test/**"], {
  query: "?raw",
  import: "default",
  eager: true,
});

describe("shared copies of server data", () => {
  it("every shared store listens to the server's changes or says why it needs not", () => {
    const files = Object.entries(SOURCES).map(([path, text]) => ({ path: path.replace(/^\.\.\//, ""), text }));

    expect(files.map((f) => f.path)).toContain("App.tsx"); // the guard reads the app's code, not an empty list
    expect(storesThatDoNotFollowTheServer(files)).toEqual([]);
  });
});
