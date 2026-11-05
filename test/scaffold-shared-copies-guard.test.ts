// @vitest-environment node
// DEV-311 — the scaffold's guard (scaffold/nsv-standard/frontend/src/test/sharedCopies.ts) catches a shared store that
// loads from the server and does not listen to its changes; every app made from the scaffold carries it. A guard that
// cannot go red is worse than none — here it is shown both ways.
import { describe, expect, it } from "vitest";

import { storesWithoutChangeListener } from "../scaffold/nsv-standard/frontend/src/test/sharedCopies";

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

describe("the scaffold's guard on shared copies (DEV-311)", () => {
  it("names a store that loads from the server and does not listen", () => {
    expect(storesWithoutChangeListener([{ path: "store/myGroupsStore.ts", text: MY_GROUPS }])).toEqual([
      "store/myGroupsStore.ts",
    ]);
  });

  it("every way of loading counts: the app's API, fetch, a client or the frame's api", () => {
    const store = (load: string) => `import { create } from "zustand";\nexport const useX = create(() => ({ load: () => ${load} }));`;
    const files = [
      { path: "a.ts", text: store('fetch("/api/v1/areas")') },
      { path: "b.ts", text: store('client.get("/areas")') },
      { path: "c.ts", text: store('api.patch("/areas/1", {})') },
      { path: "d.ts", text: store("listAreasApi()") },
    ];
    expect(storesWithoutChangeListener(files)).toEqual(["a.ts", "b.ts", "c.ts", "d.ts"]);
  });

  it("leaves alone a store that listens, a store with nothing from the server and a page that is no store", () => {
    const files = [
      { path: "store/myGroupsStore.ts", text: LISTENING },
      { path: "store/theme.ts", text: 'import { create } from "zustand";\nexport const useTheme = create(() => ({ dark: false }));' },
      { path: "pages/Areas.tsx", text: 'import { listAreasApi } from "../services/api/areas";\nvoid listAreasApi();' },
    ];
    expect(storesWithoutChangeListener(files)).toEqual([]);
  });
});
