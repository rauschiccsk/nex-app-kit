// DEV-251 — every template a manifest may name has its frame; a new template is a new folder and its id, apps on
// another template are not touched (DEV-250 B7).
import { TEMPLATES } from "../src/templates/registry";
import { TEMPLATE_IDS } from "../src/templates/ids";

describe("template registry", () => {
  it("has a frame for every template id and nothing else", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual([...TEMPLATE_IDS].sort());
    for (const id of TEMPLATE_IDS) expect(typeof TEMPLATES[id]).toBe("function");
  });
});
