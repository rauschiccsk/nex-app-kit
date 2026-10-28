/**
 * Štart predstieraných odpovedí pre ŽIVÝ NÁHĽAD (fáza Vizuál) — ICCINT-94.
 *
 * Volá sa VÝHRADNE pod `VITE_PREVIEW` a VŽDY **pred prvým vykreslením**. Keby sa spustil až po ňom,
 * prvé volania appky by odišli na neexistujúci backend a náhľad by skončil na prihlasovacej obrazovke —
 * to je presne tá porucha, ktorá 09.09.2026 zastavila prácu na hodinu a hľadala sa úplne inde
 * (ICCINT-27, ICCINT-93).
 *
 * Náhľad **neobchádza prihlásenie**. Nenasadzuje si nič do úložiska prehliadača a neexistuje príznak,
 * ktorý by stráženie obrazoviek vypol. Robí jedinú vec: odpovedá na otázku „kto som?“ presne tak, ako
 * by na ňu odpovedal backend. Preto stačí tento modul z `main.tsx` nenaimportovať a v ostrom behu po
 * náhľade nezostane ani cesta, ktorou by sa dalo dnu.
 */
import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

export async function startPreview(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({
    quiet: true,
    // Náhľad obsluhuje len /api/v1 — zvyšok (assety, prenos zmien za behu) nech ide bez zásahu.
    onUnhandledRequest: "bypass",
  });
}
