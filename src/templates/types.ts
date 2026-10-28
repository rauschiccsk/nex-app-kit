import type { ReactNode } from "react";

/** What a template receives from the app beyond the manifest: its overview page and its own routes. */
export interface TemplateProps {
  /** Prehľad — the app's own overview. */
  overview: ReactNode;
  /** The app's pages as `<Route>` elements (paths as in the manifest's entries, e.g. `/areas`, `/areas/:id`). */
  children?: ReactNode;
}
