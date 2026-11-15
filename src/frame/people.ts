// How a person and their role are named on screen — one place, so the footer, Nastavenia and the users list never
// name the same person two ways.
import { STANDARD_ROLES } from "../standard-api";
import { createTranslator, type Translate } from "nex-shared";

import { KIT_MESSAGES } from "../i18n";

/** First and last name, else the login; empty when nobody is signed in (the caller chooses the placeholder). */
export function personName(
  person: { first_name?: string | null; last_name?: string | null; username: string } | null | undefined,
): string {
  if (!person) return "";
  const full = [person.first_name, person.last_name]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return full || person.username;
}

/** The role's name in the person's language (DEV-394: `t` from `useKitT`; without one, in Slovak). */
export function roleLabel(role: string | null | undefined, t: Translate = SLOVAK): string {
  if (!role) return "—";
  const key = STANDARD_ROLES.find((r) => r.value === role)?.label;
  return key ? t(key) : role;
}

const SLOVAK = createTranslator("sk", KIT_MESSAGES);

/** The text of a failed call for a person: the server's own sentence, else the fallback. */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
