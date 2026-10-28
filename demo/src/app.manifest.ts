// The manifest of the demo app — app.manifest.json, read by the frame here and by the server there.
import { defineApp } from "nex-app-kit";

import data from "../app.manifest.json";

/** How many areas wait — the count beside „Oblasti“ (JSON cannot hold a hook, so it joins here by path). */
function useAreaCount() {
  return 3;
}

export default defineApp(data, { counts: { "/areas": useAreaCount } });
