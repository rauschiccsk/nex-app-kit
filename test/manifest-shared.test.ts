// @vitest-environment node
// DEV-252 — the frontend and the server read the same manifest (app.manifest.json) and say the same sentences:
// the cases of server/tests/manifest_cases.json run here through defineApp and there through load_manifest.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ManifestError, defineApp } from "../src/manifest";

interface Case {
  why: string;
  input: Record<string, unknown>;
  problems: string[];
}

const CASES: Case[] = JSON.parse(readFileSync(new URL("../server/tests/manifest_cases.json", import.meta.url), "utf8"));

function problemsOf(input: unknown): string[] {
  try {
    defineApp(input as never);
    return [];
  } catch (e) {
    expect(e).toBeInstanceOf(ManifestError);
    return (e as ManifestError).problems;
  }
}

describe("shared manifest cases", () => {
  it("there are some", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(5);
  });

  it.each(CASES.map((c) => [c.why, c] as const))("%s", (_why, c) => {
    expect(problemsOf(c.input)).toEqual(c.problems);
  });
});

describe("what JSON cannot hold", () => {
  const BASE = { template: "nsv-standard", name: "NEX Knowledge", initials: "NK", auth: "manager" } as const;

  it("a count joins its entry by path", () => {
    const useAreaCount = () => 3;
    const app = defineApp({ ...BASE, nav: [{ label: "Oblasti", path: "/areas", icon: "🗂️" }] }, { counts: { "/areas": useAreaCount } });

    expect(app.nav[0]?.useCount).toBe(useAreaCount);
  });

  it("a count without its entry is said", () => {
    let problems: string[] = [];
    try {
      defineApp({ ...BASE, nav: [] }, { counts: { "/areas": () => 1 } });
    } catch (e) {
      problems = (e as ManifestError).problems;
    }
    expect(problems).toEqual(["Počet pre „/areas“ nepatrí žiadnej položke ľavého panela."]);
  });

  // DEV-257: an entry only some people have (NEX Knowledge's Uchovávanie for its statutory persons).
  it("a visibility hook joins its entry by path, beside a count", () => {
    const useIsStatutory = () => true;
    const useWaiting = () => 2;
    const app = defineApp(
      { ...BASE, nav: [{ label: "Uchovávanie", path: "/statutory", icon: "🗄️" }] },
      { counts: { "/statutory": useWaiting }, visible: { "/statutory": useIsStatutory } },
    );

    expect(app.nav[0]?.useVisible).toBe(useIsStatutory);
    expect(app.nav[0]?.useCount).toBe(useWaiting);
  });

  it("a visibility hook without its entry is said", () => {
    let problems: string[] = [];
    try {
      defineApp({ ...BASE, nav: [] }, { visible: { "/statutory": () => true } });
    } catch (e) {
      problems = (e as ManifestError).problems;
    }
    expect(problems).toEqual(["Viditeľnosť pre „/statutory“ nepatrí žiadnej položke ľavého panela."]);
  });
});
