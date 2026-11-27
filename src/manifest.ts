// texts: for the agent — the manifest's sentences and the preview's sample data are read by the agent who builds the app (DEV-394).
// DEV-251 — the manifest: everything the template needs to know about an app, in one file the app owns
// (app.manifest.json). The frame reads it through defineApp, the server through load_manifest (DEV-252). A wrong value
// stops the app before it starts, with every problem named in one sentence each — the agent fixes them all in one go.
// The rules both sides check run on the same cases (server/tests/manifest_cases.json).
import type { ReactNode } from "react";
import { createTranslator, LANGUAGES, type AppMessages, type Language, type SettingsCategory, type UserRead } from "nex-shared";

import { MODULES } from "./modules";
import { TEMPLATE_IDS, type TemplateId } from "./templates/ids";

/** How people get in: the app's own password, or launched from NEX Manager (no users of its own). */
export type AppAuthMode = "password" | "manager";

/** One of the app's own entries in the left panel. */
export interface NavEntry {
  label: string;
  /** Starts with „/“; never one of the template's own paths. */
  path: string;
  /** An emoji glyph, as in the cockpit. */
  icon: string;
  /** Shown to an admin only. */
  adminOnly?: boolean;
  /** A hook the panel calls for the count shown beside the label („(3)“); nothing for 0 or none. */
  useCount?: () => number | null | undefined;
  /** DEV-257: a hook the panel calls whether to show the entry at all — for an entry only some people have (NEX
   *  Knowledge's Uchovávanie for its statutory persons). Shown only when it says `true`; while it does not know yet,
   *  the entry stays hidden. The app still guards the page itself on its server. */
  useVisible?: () => boolean | null | undefined;
}

export interface AgentRole {
  id: string;
  label: string;
}

export interface AiConfig {
  /** The agents the app runs — each gets its model and effort in Nastavenia → Agenti. */
  roles: AgentRole[];
}

export interface AppManifestInput {
  template: string;
  name: string;
  initials: string;
  /** "password" or "manager" — a string here, since app.manifest.json gives a string; checked when the app starts. */
  auth: AppAuthMode | (string & {});
  ai?: AiConfig | false;
  modules?: string[];
  nav?: NavEntry[];
  settings?: { categories?: SettingsCategory[] };
  /** DEV-394 — the languages the app speaks, its main one first (default: Slovak only). */
  languages?: string[];
  /** DEV-523 — the app has a web (web/) beside its administration: own accounts, sign-in by e-mail. */
  web?: boolean;
}

export interface AppManifest {
  readonly template: TemplateId;
  readonly name: string;
  readonly initials: string;
  readonly auth: AppAuthMode;
  readonly ai: Readonly<AiConfig> | false;
  readonly modules: readonly string[];
  readonly nav: readonly NavEntry[];
  readonly settings: { readonly categories: readonly SettingsCategory[] };
  /** The app's own action for one person in Nastavenia → Používatelia (DEV-293). */
  readonly userActions?: (user: UserRead) => ReactNode;
  /** DEV-368: whether the person sees Prehľad — the hook the app gave for „/“; none: everyone sees it. */
  readonly overviewVisible?: () => boolean | null | undefined;
  /** DEV-394 — the languages the app speaks, its main one first. */
  readonly languages: readonly Language[];
  /** DEV-394 — the app's own texts per language (labels of the left panel, its screens); keys, not words. */
  readonly messages: AppMessages;
  /** DEV-523 — the app has a web (web/): Nastavenia show its accounts and the requests to decide. */
  readonly web: boolean;
}

/** The template's own pages — an app's entry never takes their path. */
export const TEMPLATE_PATHS = ["/", "/getting-started", "/updates", "/settings"] as const;

/** A left-panel label longer than this does not fit on one line at the default width (ICC layout standard). */
export const NAV_LABEL_MAX = 22;

/** What JSON cannot hold, by the entry's path: the hook that counts what waits behind it, and the one that says
 *  whether the person sees it (DEV-257) — for „/“ whether the person sees Prehľad, the template's own entry and first
 *  screen (DEV-368). */
export interface AppExtras {
  counts?: Record<string, () => number | null | undefined>;
  visible?: Record<string, () => boolean | null | undefined>;
  /** The app's own action for one person, first in their row of Nastavenia → Používatelia — NEX Manager's „Prístupy“.
   *  Everything about people stays in that one tab; what a viewer who may not manage people sees, the app decides
   *  (DEV-293). */
  userActions?: (user: UserRead) => ReactNode;
  /** DEV-394 — the app's own texts per language (`src/locales`); a label of the left panel may be one of their keys. */
  messages?: AppMessages;
}

export class ManifestError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Manifest aplikácie nie je v poriadku:\n- ${problems.join("\n- ")}`);
    this.name = "ManifestError";
    this.problems = problems;
  }
}

const AUTH_MODES: readonly string[] = ["password", "manager"];

export function defineApp(input: AppManifestInput, extras: AppExtras = {}): AppManifest {
  const problems: string[] = [];
  const ai = input.ai ?? false;
  const modules = input.modules ?? [];
  const counts = extras.counts ?? {};
  // DEV-368: „/“ is Prehľad — the template's own entry; the rest belong to the app's entries.
  const { "/": overviewVisible, ...visible } = extras.visible ?? {};
  const nav = (input.nav ?? []).map((entry) => ({
    ...entry,
    ...(counts[entry.path] ? { useCount: counts[entry.path] } : {}),
    ...(visible[entry.path] ? { useVisible: visible[entry.path] } : {}),
  }));

  if (!(TEMPLATE_IDS as readonly string[]).includes(input.template)) {
    problems.push(`Šablóna „${input.template}“ neexistuje — sú tieto: ${TEMPLATE_IDS.join(", ")}.`);
  }
  if (!input.name || !input.name.trim()) problems.push("Chýba názov aplikácie (name).");
  const initials = input.initials ?? "";
  if (initials.length < 1 || initials.length > 4) {
    problems.push(`Iniciály (initials) majú 1 až 4 znaky — „${initials}“ má ${initials.length}.`);
  }
  if (!AUTH_MODES.includes(input.auth)) {
    problems.push(
      `Spôsob prihlásenia (auth) je „password“ (vlastné heslo) alebo „manager“ (spustenie z NEX Managera), nie „${input.auth}“.`,
    );
  }
  if (ai) {
    if (!ai.roles || ai.roles.length === 0) problems.push("Aplikácia s AI (ai) menuje aspoň jednu rolu agenta.");
    for (const id of duplicates((ai.roles ?? []).map((r) => r.id))) problems.push(`Rola agenta „${id}“ je uvedená dvakrát.`);
  }
  const available = Object.keys(MODULES);
  for (const id of modules) {
    if (!MODULES[id]) {
      problems.push(
        `Voliteľný modul „${id}“ šablóna zatiaľ nemá — dostupné: ${available.length ? available.join(", ") : "žiadne"}.`,
      );
    }
  }
  const shownIn = (input.languages ?? ["sk"]).filter((code) => LANGUAGES.some((l) => l.code === code)) as Language[];
  for (const entry of nav) {
    // DEV-394: a label may be a key of the app's texts — what has to fit is what the panel shows, in every language.
    for (const shown of new Set(shownIn.map((code) => createTranslator(code, extras.messages ?? {})(entry.label)))) {
      if ([...shown].length > NAV_LABEL_MAX) {
        problems.push(`Položka „${shown}“ má ${[...shown].length} znakov — v ľavom paneli sa zmestí najviac ${NAV_LABEL_MAX}.`);
      }
    }
    if (!entry.icon || !entry.icon.trim()) problems.push(`Položka „${entry.label}“ nemá ikonu.`);
    if (!entry.path.startsWith("/")) {
      problems.push(`Položka „${entry.label}“: cesta „${entry.path}“ musí začínať lomkou.`);
    } else if ((TEMPLATE_PATHS as readonly string[]).includes(entry.path)) {
      problems.push(
        `Položka „${entry.label}“: cesta „${entry.path}“ patrí šablóne (Prehľad, Ako začať, Aktualizácie, Nastavenia).`,
      );
    }
  }
  for (const label of duplicates(nav.map((n) => n.label))) problems.push(`Položka „${label}“ je v ľavom paneli dvakrát.`);
  for (const path of duplicates(nav.map((n) => n.path))) problems.push(`Cesta „${path}“ je v ľavom paneli dvakrát.`);
  for (const path of Object.keys(visible)) {
    if (!nav.some((n) => n.path === path)) {
      problems.push(`Viditeľnosť pre „${path}“ nepatrí žiadnej položke ľavého panela.`);
    }
  }
  for (const path of Object.keys(counts)) {
    if (!nav.some((n) => n.path === path)) problems.push(`Počet pre „${path}“ nepatrí žiadnej položke ľavého panela.`);
  }

  const languages = input.languages ?? ["sk"];
  const known = LANGUAGES.map((l) => l.code as string);
  if (languages.length === 0) problems.push("Zoznam jazykov (languages) je prázdny — aplikácia hovorí aspoň jedným.");
  for (const code of languages) {
    if (!known.includes(code)) problems.push(`Jazyk „${code}“ šablóna nepozná — pozná tieto: ${known.join(", ")}.`);
  }
  for (const code of duplicates(languages)) problems.push(`Jazyk „${code}“ je uvedený dvakrát.`);
  const web: unknown = input.web ?? false;
  if (typeof web !== "boolean") problems.push("Webový frontend (web) je true alebo false.");
  else if (web && input.auth === "manager") {
    problems.push("Webový frontend (web) má len aplikácia s vlastným heslom (auth „password“) — web sa prihlasuje e-mailom.");
  }
  const messages = extras.messages ?? {};
  const main = languages[0] as Language | undefined;
  for (const key of Object.keys((main && messages[main]) ?? {})) {
    for (const code of languages.slice(1) as Language[]) {
      if (!(key in (messages[code] ?? {}))) problems.push(`Text „${key}“ nemá preklad v jazyku „${code}“.`);
    }
  }

  if (problems.length) throw new ManifestError(problems);

  return Object.freeze({
    template: input.template as TemplateId,
    name: input.name,
    initials: input.initials,
    auth: input.auth as AppAuthMode,
    ai: ai ? Object.freeze({ roles: Object.freeze([...ai.roles]) as AgentRole[] }) : false,
    modules: Object.freeze([...modules]),
    nav: Object.freeze([...nav]),
    settings: Object.freeze({ categories: Object.freeze([...(input.settings?.categories ?? [])]) }),
    ...(extras.userActions ? { userActions: extras.userActions } : {}),
    ...(overviewVisible ? { overviewVisible } : {}),
    languages: Object.freeze([...languages]) as Language[],
    messages,
    web: web === true,
  });
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const v of values) (seen.has(v) ? twice : seen).add(v);
  return [...twice];
}
