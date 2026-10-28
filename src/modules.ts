// The optional modules of a template — what an app switches on with one line of its manifest (DEV-250, phase 4 adds
// Poznámky, Poradca, Dokumenty). Each brings its left-panel entry and its page; the template places them right under
// „Ako začať“, the way the cockpit has „Poznámky“.
import type { ReactNode } from "react";

export interface ModuleDefinition {
  id: string;
  label: string;
  icon: string;
  /** Where the module's page lives — never one of the template's own paths. */
  path: string;
  page: () => ReactNode;
}

export const MODULES: Readonly<Record<string, ModuleDefinition>> = Object.freeze({});
