// How the signed-in person arranged the screen (the cockpit's DEV-82): read from the server once per person, changed
// here and kept there, so it is the same on every computer and every person has their own. A change shows at once;
// when the server refuses it, the previous layout comes back — the screen never shows a layout that was not kept.
import { createStore } from "zustand/vanilla";

import type { StandardApi, UserLayout, UserLayoutChanges } from "../standard-api";

export interface LayoutState {
  /** `null` until read from the server; the screen keeps its defaults meanwhile. */
  layout: UserLayout | null;
  load: () => Promise<void>;
  save: (changes: UserLayoutChanges) => Promise<void>;
  /** Another person signs in — nothing of the previous one's layout stays. */
  reset: () => void;
}

export function createLayoutStore(api: StandardApi) {
  return createStore<LayoutState>()((set, get) => ({
    layout: null,
    load: async () => {
      try {
        set({ layout: await api.getLayout() });
      } catch {
        /* the layout is a convenience, never a reason to break the screen */
      }
    },
    save: async (changes) => {
      const before = get().layout;
      if (before) set({ layout: { ...before, ...changes } });
      try {
        set({ layout: await api.saveLayout(changes) });
      } catch {
        set({ layout: before });
      }
    },
    reset: () => set({ layout: null }),
  }));
}
