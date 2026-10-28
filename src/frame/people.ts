// How a person and their role are named on screen — one place, so the footer, Nastavenia and the users list never
// name the same person two ways.
import { STANDARD_ROLES } from "../standard-api";

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

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return STANDARD_ROLES.find((r) => r.value === role)?.label ?? role;
}

/** The text of a failed call for a person: the server's own sentence, else the fallback. */
export function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
