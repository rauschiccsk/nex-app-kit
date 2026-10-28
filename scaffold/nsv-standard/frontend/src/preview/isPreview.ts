/**
 * Je zapnutý živý náhľad? (ICCINT-95, ICCINT-107)
 *
 * ⚠️ **Rozhodovanie je TU, nie v podmienke.** Vo `main.tsx` stojí `import.meta.env.VITE_PREVIEW`
 * ešte raz — ale ako **statická poistka**, nie ako rozhodnutie. Sú to dve rôzne veci a oplatí sa
 * mať ich oddelene:
 *
 * - **poistka** (v `main.tsx`): zostavovač `import.meta.env.VITE_PREVIEW` nahradí literálom, takže
 *   keď premenná nie je nastavená, celá vetva náhľadu je mŕtva a MSW ani fixtures (~200 kB) sa do
 *   ostrého zostavenia nedostanú. Zmerané: bez nej sa tam `startPreview` naozaj dostal.
 * - **rozhodovanie** (tu): porovnanie so ZOZNAMOM zapínacích hodnôt — čitateľné a skúšateľné
 *   samostatne, bez toho, aby na ňom visela veľkosť zväzku.
 *
 * ⚠️ **Nikdy pravdivostne a nikdy s jediným slovom.** Oba omyly sa už stali:
 * - jediné slovo sa minulo s hodnotou a náhľad sa vôbec nezapol (ICCINT-93);
 * - pravdivostná kontrola má opačnú chybu — v JavaScripte je pravdivý aj reťazec `"false"`, takže
 *   `VITE_PREVIEW=false` by náhľad ZAPLO (ICCINT-95). Zvyk vypínať slovom „false“ je pritom živý.
 *
 * Vzor pochádza zo stavby NEX Manager 1.2.0, kde ho agent navrhol lepšie než pôvodná šablóna.
 */

/** Hodnoty, ktoré náhľad ZAPÍNAJÚ — a nič iné. `false`, `0`, `off` ani prázdno ho nezapnú. */
const ENABLING_VALUES = ["1", "true", "yes", "on"];

export function isPreviewEnabled(
  value: string | undefined = import.meta.env.VITE_PREVIEW,
): boolean {
  return typeof value === "string" && ENABLING_VALUES.includes(value);
}
