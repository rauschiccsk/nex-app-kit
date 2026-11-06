/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * The live preview (the „Vizuál“ phase) — NEX Studio sets it, the app only reads it (ICCINT-93/94).
   *
   * The values `1`, `true`, `yes`, `on` switch it on — and nothing else. Compare with that WHOLE list
   * (see `preview/isPreview.ts`), not with a single word and not by truthiness:
   *
   * - a single word once missed the value and the preview never switched on — the manager saw the
   *   sign-in screen and looked for the real cause elsewhere (ICCINT-93);
   * - a truthiness check has the opposite fault: in JavaScript the string `"false"` is truthy too, so
   *   `VITE_PREVIEW=false` would switch the preview ON (ICCINT-95). `false`, `0` and `off` MUST NOT
   *   switch it on.
   */
  readonly VITE_PREVIEW?: string;
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
