// @vitest-environment node
// DEV-252 — one tag for both halves: the frontend package and the server package carry the same version, so an app
// that pins nex-app-kit at a tag gets a frame and a server that understand each other.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("version", () => {
  it("the frontend and the server have the same version, and the changelog names it", () => {
    const frontend = JSON.parse(read("../package.json")).version as string;
    const server = /^version = "([^"]+)"$/m.exec(read("../server/pyproject.toml"))?.[1];

    expect(server).toBe(frontend);
    expect(read("../CHANGELOG.md")).toMatch(new RegExp(`^## v${frontend.replaceAll(".", "\\.")}$`, "m"));
  });
});
