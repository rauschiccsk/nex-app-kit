// The app's manifest — app.manifest.json, read here by the frame and by the server (backend/app/kit.py). Left-panel
// entries, agent roles and setting categories go into the JSON; what JSON cannot hold joins here, e.g. the count
// beside an entry: defineApp(data, { counts: { "/areas": useAreaCount } }).
import { defineApp } from "nex-app-kit";

import data from "../app.manifest.json";

export const manifest = defineApp(data);
