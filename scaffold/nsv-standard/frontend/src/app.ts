// The app's manifest — app.manifest.json, read here by the frame and by the server (backend/app/kit.py). Left-panel
// entries, agent roles and setting categories go into the JSON; what JSON cannot hold joins here, e.g. the count
// beside an entry: defineApp(data, { counts: { "/areas": useAreaCount } }).
import { defineApp } from "nex-app-kit";

import data from "../app.manifest.json";
import { messages } from "./locales";

// DEV-394: the app's own texts (src/locales) — every text a person reads; the frame says them in the person's language.
// DEV-535: the catalog of steps Sprievodca leads a person through — every important action of the app, with its screen,
// its button (data-guide) and the checks whether it can be done and is done (KONTRAKT.md → Sprievodca). Until it has a
// step, the frame keeps „Ako začať“ with the written guide:
//   defineApp(data, { messages, guide: { steps: [...], subjects: { ... } } })
export const manifest = defineApp(data, { messages, guide: { steps: [] } });
