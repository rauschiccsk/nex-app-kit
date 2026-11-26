// DEV-517 — the screens the person walked through from a left-panel entry, in this browser tab: KitPage's back link
// names the previous one. NEX DualBook 0.1.0 had it first (the Manager's request in the Vizuál phase, 26.11.2026).
// Copy of server data: none — only addresses and names of the screens visited.
import { create } from "zustand";

export interface VisitedScreen {
  /** The screen's place, without the query — one place is one step of the walk. */
  pathname: string;
  /** The place with its query: the way back keeps the filters and the tab the screen had. */
  path: string;
  label: string;
}

interface NavHistory {
  stack: VisitedScreen[];
  /** A screen shown; a left-panel entry (``startsWalk``) begins a new walk, and a screen already on the walk (the way
   *  back) forgets what came after it. */
  visit: (screen: VisitedScreen, startsWalk: boolean) => void;
}

export const useNavHistory = create<NavHistory>((set) => ({
  stack: [],
  visit: (screen, startsWalk) =>
    set(({ stack }) => {
      if (startsWalk) return { stack: [screen] };
      const at = stack.findIndex((s) => s.pathname === screen.pathname);
      if (at >= 0) return { stack: [...stack.slice(0, at), screen] };
      return { stack: [...stack, screen] };
    }),
}));
