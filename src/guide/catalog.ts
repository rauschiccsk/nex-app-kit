// texts: for the agent — the catalog's problems are the manifest's sentences, read by the agent who builds the app.
// DEV-535 — the catalog of an app's steps: the only things Sprievodca guides through. Each step says what the person
// does, on which screen and with which button, what it needs done first, the kind of object it applies to, and — by
// asking the app's own interface — whether it can be done now and whether it is done. Sprievodca composes a path only
// from these steps (the server refuses any other), and the guiding moves on when a step's check says it is done.
// The Director 28.11.2026: a person who has never seen the app „sadol si k naším aplikáciám a začal používať“.

/** One step of the catalog. Texts are keys of the app's own texts (or plain text). */
export interface GuideStep {
  /** Unique, e.g. `etalon.upload`; the button on the screen carries it as `data-guide` unless `target` says otherwise. */
  id: string;
  title: string;
  /** One sentence: what the person does now („Kliknite Nahrať súbory a vyberte preklad aj predlohu“). */
  hint: string;
  /** Where it is done, in words („Etalón → celok → Súbory“). */
  screen: string;
  /** The address of the screen — for the object when the step applies to one. */
  path: (subject?: string) => string;
  /** The `data-guide` of the button, when it is not the step's id. */
  target?: string;
  /** The kind of object the step applies to (a key of the catalog's `subjects`). */
  subject?: string;
  /** Steps that must be done first (for the same object when they apply to the same kind). */
  requires?: string[];
  /** Whether it can be done now; by default yes. */
  isAvailable?: (subject?: string) => boolean | Promise<boolean>;
  /** Whether it is done — the guiding moves on when this says yes. */
  isDone: (subject?: string) => boolean | Promise<boolean>;
}

/** A kind of object steps apply to — the objects there are, by the app's interface. */
export interface GuideSubjectKind {
  list: () => Promise<{ id: string; label: string }[]>;
}

export interface GuideCatalog {
  steps: GuideStep[];
  subjects?: Record<string, GuideSubjectKind>;
}

/** The attribute marking a step's button on its screen: `<Button {...guideTarget("etalon.upload")}>`. */
export function guideTarget(id: string): { "data-guide": string } {
  return { "data-guide": id };
}

/** What the server is sent: the steps with what the screen measured, and the objects there are. */
export interface MeasuredCatalog {
  catalog: {
    id: string;
    title: string;
    hint: string;
    screen: string;
    subject_kind: string | null;
    requires: string[];
    state: Record<string, { available: boolean; done: boolean }>;
  }[];
  subjects: Record<string, { id: string; label: string }[]>;
}

/** How many objects of one kind are measured — the latest the app lists first. */
export const SUBJECTS_MAX = 30;
/** A check that does not answer in time counts as „not available, not done“. */
const CHECK_TIMEOUT_MS = 5000;

async function settled<T>(check: () => T | Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(check),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), CHECK_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

/** Measure the catalog against the app as it is now; `t` says the texts in the person's language. */
export async function measure(catalog: GuideCatalog, t: (key: string) => string): Promise<MeasuredCatalog> {
  const subjects: MeasuredCatalog["subjects"] = {};
  for (const [kind, source] of Object.entries(catalog.subjects ?? {})) {
    subjects[kind] = (await settled(() => source.list(), [])).slice(0, SUBJECTS_MAX);
  }
  const steps = await Promise.all(
    catalog.steps.map(async (step) => {
      const on = step.subject ? (subjects[step.subject] ?? []).map((s) => s.id) : [undefined];
      const state: Record<string, { available: boolean; done: boolean }> = {};
      for (const subject of on) {
        const [available, done] = await Promise.all([
          settled(() => (step.isAvailable ? step.isAvailable(subject) : true), false),
          settled(() => step.isDone(subject), false),
        ]);
        state[subject ?? ""] = { available, done };
      }
      return {
        id: step.id,
        title: t(step.title),
        hint: t(step.hint),
        screen: t(step.screen),
        subject_kind: step.subject ?? null,
        requires: [...(step.requires ?? [])],
        state,
      };
    }),
  );
  return { catalog: steps, subjects };
}

/** What is wrong with a catalog — said when the app starts, like every other problem of the manifest. */
export function catalogProblems(catalog: GuideCatalog): string[] {
  const problems: string[] = [];
  const ids = catalog.steps.map((s) => s.id);
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) problems.push(`Krok Sprievodcu „${id}“ je v katalógu dvakrát.`);
    seen.add(id);
  }
  for (const step of catalog.steps) {
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(step.id)) problems.push(`Krok Sprievodcu „${step.id}“: id má malé písmená, číslice, bodky.`);
    if (!step.title || !step.hint || !step.screen) problems.push(`Krok Sprievodcu „${step.id}“ potrebuje title, hint aj screen.`);
    for (const needed of step.requires ?? []) {
      if (!seen.has(needed)) problems.push(`Krok Sprievodcu „${step.id}“ potrebuje „${needed}“, ktorý v katalógu nie je.`);
    }
    if (step.subject && !(catalog.subjects ?? {})[step.subject]) {
      problems.push(`Krok Sprievodcu „${step.id}“ sa vzťahuje na „${step.subject}“, ktorý katalóg nemá medzi objektmi.`);
    }
  }
  return problems;
}
