// DEV-311, DEV-316 — the rule of `KONTRAKT.md` „Údaje na viacerých obrazovkách“: every shared store (zustand) of the
// app listens to the server's changes (onServerChange of nex-shared) and refreshes itself, or says in one line why it
// needs not. Without it a change made on one screen stays unseen on another until the page is reloaded — 05.11.2026
// NEX Manager: the e-mail changed in „Používatelia“, „Moje konto“ kept the old one. The guard does not guess which
// stores load from the server: its first form looked for the ways of loading and missed a store that loads through a
// helper of its own (06.11.2026).
//
// The line, in the store's own file, is one of:
//   Copy of server data: none — <why: what the store holds instead>
//   Copy of server data: changed only by this store — <why no other screen changes it>

export interface SourceFile {
  path: string;
  text: string;
}

/** A module that makes a zustand store: imports zustand (or zustand/vanilla …) and calls create or createStore. */
const ZUSTAND = /from\s+["']zustand(\/[\w-]+)?["']/;
const CREATES_STORE = /\b(create|createStore)\s*[<(]/;
const LISTENS = /\bonServerChange\s*\(/;
const SAYS_WHY = /Copy of server data: (none|changed only by this store) — \S/;

/** The shared stores among *files* that neither listen to the server's changes nor say why they need not — by path. */
export function storesThatDoNotFollowTheServer(files: SourceFile[]): string[] {
  return files
    .filter(({ text }) => ZUSTAND.test(text) && CREATES_STORE.test(text))
    .filter(({ text }) => !LISTENS.test(text) && !SAYS_WHY.test(text))
    .map(({ path }) => path);
}
