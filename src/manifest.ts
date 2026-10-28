// DEV-251 — the manifest: everything the template needs to know about an app, in one file the app owns
// (src/app.manifest.ts). The frame reads it, the server will read the same (phase 2). A wrong value stops the app
// before it starts, with every problem named in one sentence each — the agent fixes them all in one go.
import type { SettingsCategory } from "nex-shared";

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
  auth: AppAuthMode;
  ai?: AiConfig | false;
  modules?: string[];
  nav?: NavEntry[];
  settings?: { categories?: SettingsCategory[] };
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
}

/** The template's own pages — an app's entry never takes their path. */
export const TEMPLATE_PATHS = ["/", "/getting-started", "/updates", "/settings"] as const;

/** A left-panel label longer than this does not fit on one line at the default width (ICC layout standard). */
export const NAV_LABEL_MAX = 22;

export class ManifestError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Manifest aplikácie nie je v poriadku:\n- ${problems.join("\n- ")}`);
    this.name = "ManifestError";
    this.problems = problems;
  }
}

const AUTH_MODES: readonly string[] = ["password", "manager"];

export function defineApp(input: AppManifestInput): AppManifest {
  const problems: string[] = [];
  const ai = input.ai ?? false;
  const modules = input.modules ?? [];
  const nav = input.nav ?? [];

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
  for (const entry of nav) {
    if ([...entry.label].length > NAV_LABEL_MAX) {
      problems.push(
        `Položka „${entry.label}“ má ${[...entry.label].length} znakov — v ľavom paneli sa zmestí najviac ${NAV_LABEL_MAX}.`,
      );
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

  if (problems.length) throw new ManifestError(problems);

  return Object.freeze({
    template: input.template as TemplateId,
    name: input.name,
    initials: input.initials,
    auth: input.auth,
    ai: ai ? Object.freeze({ roles: Object.freeze([...ai.roles]) as AgentRole[] }) : false,
    modules: Object.freeze([...modules]),
    nav: Object.freeze([...nav]),
    settings: Object.freeze({ categories: Object.freeze([...(input.settings?.categories ?? [])]) }),
  });
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const v of values) (seen.has(v) ? twice : seen).add(v);
  return [...twice];
}
