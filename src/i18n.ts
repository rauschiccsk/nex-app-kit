// DEV-394 — the template's texts in the person's language, on top of nex-shared's catalogs (DEV-393).
//
// The template's own texts live in its catalogs (locales/); the app's texts join them through the manifest's
// `messages`. The frame tells nex-shared the person's language (TemplateApp); a component of the template translates
// with `useKitT`, which knows the template's catalogs even where a screen is drawn without the frame (a test, an app
// embedding one page) — so the template never shows a key.
import { useMemo } from "react";
import { createTranslator, useLanguage, useT, type AppMessages, type Language, type Translate } from "nex-shared";

import { kitEn } from "./locales/en";
import { kitHu } from "./locales/hu";
import { kitSk } from "./locales/sk";

export type { KitMessageKey } from "./locales/sk";

/** The template's own catalogs. */
export const KIT_MESSAGES: AppMessages = { sk: kitSk, hu: kitHu, en: kitEn };

/** The template's catalogs with the app's over them — the app may say a template's text its own way. */
export function mergeMessages(app: AppMessages | undefined): AppMessages {
  const merged: AppMessages = {};
  for (const language of new Set([...Object.keys(KIT_MESSAGES), ...Object.keys(app ?? {})]) as Set<Language>) {
    merged[language] = { ...KIT_MESSAGES[language], ...app?.[language] };
  }
  return merged;
}

/** The translator of the current language that knows the template's texts too. */
export function useKitT(): Translate {
  const t = useT();
  const { language } = useLanguage();
  return useMemo(() => {
    const kit = createTranslator(language, KIT_MESSAGES);
    return (key, params) => {
      const said = t(key, params);
      return said === key ? kit(key, params) : said;
    };
  }, [t, language]);
}

/** The person's language: their own choice, else the installation's, else the app's first — one it speaks. */
export function chooseLanguage(
  offered: readonly Language[],
  personal: string | null | undefined,
  installation: string | null | undefined,
): Language {
  for (const candidate of [personal, installation]) {
    if (candidate && (offered as readonly string[]).includes(candidate)) return candidate as Language;
  }
  return offered[0] ?? "sk";
}
