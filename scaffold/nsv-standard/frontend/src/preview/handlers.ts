/**
 * Answers for the Vizuál preview, which runs WITHOUT a server (MSW, ICCINT-94).
 *
 * The frame's own routes — sign-in, Moje konto, Nastavenia, Aktualizácie, Ako začať, layout — are answered by the
 * template (nex-app-kit/preview): the preview opens signed in, with the whole frame. Add answers for the app's OWN
 * screens after them, with representative example data:
 *
 *   http.get("/api/v1/areas", () => HttpResponse.json([{ id: 1, name: "Stavebné povolenia" }])),
 */
import { previewHandlers } from "nex-app-kit/preview";

import { manifest } from "../app";

export const handlers = [...previewHandlers({ manifest })];
