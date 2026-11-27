// The web and the administration are one app: the web's manifest (web/app.manifest.json — the web is built from its own
// folder) names the same app as the administration's (frontend/app.manifest.json, which the server reads), and says
// it has a web (DEV-523). Read from the files as they are, so a change in one without the other turns this red.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("the web's manifest", () => {
  it("names the same app as the administration's, with a web", () => {
    const web = read("../../app.manifest.json");
    const admin = read("../../../frontend/app.manifest.json");

    for (const key of ["template", "name", "initials", "auth", "languages"]) expect(web[key], key).toEqual(admin[key]);
    expect([web.web, admin.web]).toEqual([true, true]);
  });
});
