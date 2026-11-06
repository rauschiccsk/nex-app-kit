// DEV-311 — the rule of `KONTRAKT.md` „Údaje na viacerých obrazovkách“: a shared store (zustand) that loads data from
// the server listens to the server's changes (onServerChange of nex-shared) and refreshes itself. Without it a change
// made on one screen stays unseen on another until the page is reloaded — 05.11.2026 NEX Manager: the e-mail changed in
// „Používatelia“, „Moje konto“ kept the old one.

export interface SourceFile {
  path: string;
  text: string;
}

const ZUSTAND = /from\s+["']zustand["']/;
const CREATES_STORE = /\bcreate\s*[<(]/;
const LOADS_FROM_SERVER = [
  /from\s+["'][^"']*services\/api[^"']*["']/, // the app's API functions
  /\bfetch\s*\(/,
  /\b(api|client)\s*\.\s*(get|post|put|patch|delete|request)\s*[<(]/,
  /\b\w+Api\s*\(/, // listMyGroupsApi(…) and the like
];

/** The shared stores among *files* that load from the server and do not listen to its changes — by path. */
export function storesWithoutChangeListener(files: SourceFile[]): string[] {
  return files
    .filter(({ text }) => ZUSTAND.test(text) && CREATES_STORE.test(text))
    .filter(({ text }) => LOADS_FROM_SERVER.some((pattern) => pattern.test(text)))
    .filter(({ text }) => !/\bonServerChange\s*\(/.test(text))
    .map(({ path }) => path);
}
