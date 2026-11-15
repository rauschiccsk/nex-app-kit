// DEV-394 — an app that speaks more than one language writes no text into its code: every one comes from the catalogs
// (src/locales), so each person reads the app in their language. The cockpit runs the same rule when it verifies a
// version (nex-check-texts).
import { check } from "nex-app-kit/check-texts";
import { describe, expect, it } from "vitest";

import { manifest } from "../app";

describe("the app's texts", () => {
  it.skipIf(manifest.languages.length < 2)("are all in the catalogs, none written into the code", () => {
    expect(check("src")).toEqual([]);
  });
});
