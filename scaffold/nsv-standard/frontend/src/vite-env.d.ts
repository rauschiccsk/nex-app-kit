/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Živý náhľad (fáza Vizuál) — nastavuje ho NEX Studio, appka ho len číta (ICCINT-93/94).
   *
   * Zapínajú ho hodnoty `1`, `true`, `yes`, `on` — a nič iné. Porovnávaj s CELÝM tým zoznamom
   * (viď `main.tsx`), nie s jediným slovom a nie pravdivostne:
   *
   * - jediné slovo sa už raz minulo s hodnotou a náhľad sa vôbec nezapol — Manažér z toho videl
   *   prihlasovaciu obrazovku a skutočnú príčinu hľadal inde (ICCINT-93);
   * - pravdivostná kontrola má opačnú chybu: v JavaScripte je pravdivý aj reťazec `"false"`, takže
   *   `VITE_PREVIEW=false` by náhľad ZAPLO (ICCINT-95). `false`, `0` ani `off` ho zapnúť NESMÚ.
   */
  readonly VITE_PREVIEW?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
