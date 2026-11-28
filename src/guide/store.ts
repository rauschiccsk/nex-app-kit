// DEV-535 — where Sprievodca stands in this browser: the conversation, the composed path and the step the person is on.
// Kept in the browser for the person signed in, so the guiding survives a move between screens and a reload; a different
// person starts afresh. Copy of server data: none — the server keeps the session, this only the screen's place in it.
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { GuidePathStep } from "../standard-api";

export type GuidePhase = "idle" | "thinking" | "asking" | "planned" | "missing" | "guiding" | "finished";

export interface GuideLine {
  by: "person" | "guide";
  text: string;
}

interface GuideState {
  /** Whose guiding this is — another person signed in starts with nothing. */
  owner: string | null;
  open: boolean;
  phase: GuidePhase;
  sessionId: string | null;
  lines: GuideLine[];
  steps: GuidePathStep[];
  current: number;
  /** When the person came to the current step (ms) — a long stay is reported once as „stuck“. */
  stepSince: number | null;
  stuckReported: boolean;
  rated: boolean;
  setOwner: (owner: string | null) => void;
  setOpen: (open: boolean) => void;
  say: (line: GuideLine) => void;
  think: () => void;
  answered: (phase: GuidePhase, sessionId: string, steps: GuidePathStep[]) => void;
  startGuiding: (now: number) => void;
  goTo: (index: number, now: number) => void;
  markStuck: () => void;
  finish: () => void;
  markRated: () => void;
  reset: () => void;
}

const EMPTY = {
  open: false,
  phase: "idle" as GuidePhase,
  sessionId: null,
  lines: [] as GuideLine[],
  steps: [] as GuidePathStep[],
  current: 0,
  stepSince: null,
  stuckReported: false,
  rated: false,
};

export const useGuide = create<GuideState>()(
  persist(
    (set, get) => ({
      owner: null,
      ...EMPTY,
      setOwner: (owner) => {
        if (get().owner !== owner) set({ owner, ...EMPTY });
      },
      setOpen: (open) => set({ open }),
      say: (line) => set((s) => ({ lines: [...s.lines, line] })),
      think: () => set({ phase: "thinking" }),
      answered: (phase, sessionId, steps) => set({ phase, sessionId, steps, current: 0 }),
      startGuiding: (now) => set({ phase: "guiding", current: 0, stepSince: now, stuckReported: false, rated: false }),
      goTo: (index, now) => set({ current: index, stepSince: now, stuckReported: false }),
      markStuck: () => set({ stuckReported: true }),
      finish: () => set({ phase: "finished", stepSince: null }),
      markRated: () => set({ rated: true }),
      reset: () => set({ ...EMPTY, open: get().open }),
    }),
    {
      name: "nex_guide",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ owner, phase, sessionId, lines, steps, current, stepSince, stuckReported, rated }) => ({
        owner,
        phase: phase === "thinking" ? "idle" : phase,
        sessionId,
        lines,
        steps,
        current,
        stepSince,
        stuckReported,
        rated,
      }),
    },
  ),
);
