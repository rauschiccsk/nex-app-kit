// What every part of a template reads: the app's manifest, the standard interface, the signed-in person and the
// person's layout. One context, filled by TemplateApp — a template never reaches past it to the app.
import { createContext, useContext } from "react";
import type { StoreApi } from "zustand";

import type { AppManifest } from "../manifest";
import type { CurrentUser, StandardApi } from "../standard-api";
import type { LayoutState } from "./layoutStore";

export interface Frame {
  manifest: AppManifest;
  api: StandardApi;
  /** The signed-in person as the frame knows them now — a change in Moje konto shows at once. */
  user: CurrentUser | null;
  setUser: (user: CurrentUser) => void;
  isAdmin: boolean;
  /** Nothing for an app that has no logout (launched from NEX Manager): the footer then has no logout button. */
  onLogout?: () => void;
  /** The frontend's own version, when the app passes it — the brand then says when it differs from the server's. */
  frontendVersion?: string;
  layout: StoreApi<LayoutState>;
}

export const FrameContext = createContext<Frame | null>(null);

export function useFrame(): Frame {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error("useFrame must be used inside <TemplateApp>");
  return frame;
}
