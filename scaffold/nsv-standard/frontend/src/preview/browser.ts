/**
 * Starts the mocked answers of the LIVE PREVIEW (the „Vizuál“ phase) — ICCINT-94.
 *
 * Called ONLY under `VITE_PREVIEW` and ALWAYS **before the first render**. Started after it, the app's
 * first calls would go to a backend that does not exist and the preview would end on the sign-in screen —
 * exactly the fault that stopped the work for an hour on 09.09.2026 and was looked for somewhere else
 * entirely (ICCINT-27, ICCINT-93).
 *
 * The preview **does not bypass the sign-in**. It puts nothing into the browser's storage and there is no
 * flag that would switch the guarding of screens off. It does one thing only: it answers the question
 * "who am I?" exactly as the backend would. So it is enough not to import this module from `main.tsx`,
 * and no path in from the preview is left in a production run.
 */
import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

export async function startPreview(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    quiet: true,
    // The preview serves /api/v1 only — the rest (assets, hot module replacement) passes untouched.
    onUnhandledRequest: "bypass",
  });
}
