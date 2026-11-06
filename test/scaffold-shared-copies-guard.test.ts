// @vitest-environment node
// DEV-311, DEV-316 — the scaffold's guard (scaffold/nsv-standard/frontend/src/test/sharedCopies.ts): every shared store
// of an app listens to the server's changes or says in one line why it needs not; every app made from the scaffold
// carries it. It guesses nothing: 06.11.2026 its first form looked for the ways a store loads from the server and missed
// a store that loads through a helper of its own. A guard that cannot go red is worse than none — shown both ways here.
import { describe, expect, it } from "vitest";

import { storesThatDoNotFollowTheServer } from "../scaffold/nsv-standard/frontend/src/test/sharedCopies";

// NEX Manager's store of the groups a person owns, as it stood on 05.11.2026 (store/myGroupsStore.ts, shortened).
const MY_GROUPS = `import { create } from "zustand";
import { listMyGroupsApi, type GroupSummary } from "../services/api/groups";
export const useMyGroupsStore = create<State>((set) => ({
  groups: [],
  load: async () => set({ groups: await listMyGroupsApi() }),
}));`;

const LISTENING = `${MY_GROUPS}
onServerChange(({ path }) => {
  if (path.startsWith("/groups")) void useMyGroupsStore.getState().load();
});`;

const store = (body: string, from = "zustand", create = "create") =>
  `import { ${create} } from "${from}";\nexport const useX = ${create}(() => ({ ${body} }));`;

describe("the scaffold's guard on shared copies (DEV-311, DEV-316)", () => {
  it("names a store that loads from the server and does not listen", () => {
    expect(storesThatDoNotFollowTheServer([{ path: "store/myGroupsStore.ts", text: MY_GROUPS }])).toEqual([
      "store/myGroupsStore.ts",
    ]);
  });

  it("names a store however it loads — through the app's own helper too, without guessing how", () => {
    const helper = `import { loadAreas } from "../lib/areas";\n${store("areas: [], load: async () => loadAreas()")}`;
    const files = [
      { path: "a.ts", text: store('load: () => fetch("/api/v1/areas")') },
      { path: "b.ts", text: helper },
      { path: "c.ts", text: store("areas: []") },
    ];
    expect(storesThatDoNotFollowTheServer(files)).toEqual(["a.ts", "b.ts", "c.ts"]);
  });

  it("a vanilla store (zustand/vanilla, createStore) is a store too", () => {
    const vanilla = store("layout: null", "zustand/vanilla", "createStore");
    expect(storesThatDoNotFollowTheServer([{ path: "frame/layoutStore.ts", text: vanilla }])).toEqual([
      "frame/layoutStore.ts",
    ]);
  });

  it("leaves alone a store that listens, a store that says why it needs not, and a page that is no store", () => {
    const files = [
      { path: "store/myGroupsStore.ts", text: LISTENING },
      {
        path: "store/theme.ts",
        text: `// Copy of server data: none — the theme lives in this browser only.\n${store("dark: false")}`,
      },
      {
        path: "store/draft.ts",
        text: `/* Copy of server data: changed only by this store — the draft is saved from here alone. */\n${store("d: 1")}`,
      },
      { path: "pages/Areas.tsx", text: 'import { listAreasApi } from "../services/api/areas";\nvoid listAreasApi();' },
    ];
    expect(storesThatDoNotFollowTheServer(files)).toEqual([]);
  });

  it("a reason line without a reason, or another reason, does not count", () => {
    const files = [
      { path: "a.ts", text: `// Copy of server data: none —\n${store("x: 1")}` },
      { path: "b.ts", text: `// Copy of server data: maybe — later.\n${store("x: 1")}` },
      { path: "c.ts", text: `// onServerChange is not needed here\n${store("x: 1")}` },
    ];
    expect(storesThatDoNotFollowTheServer(files)).toEqual(["a.ts", "b.ts", "c.ts"]);
  });
});
