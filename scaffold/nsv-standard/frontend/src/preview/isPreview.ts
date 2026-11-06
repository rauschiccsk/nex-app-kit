/**
 * Is the live preview switched on? (ICCINT-95, ICCINT-107)
 *
 * ⚠️ **The decision is HERE, not in the condition.** `main.tsx` checks `import.meta.env.VITE_PREVIEW`
 * once more — but as a **static guard**, not as the decision. These are two different things and it
 * pays to keep them apart:
 *
 * - **the guard** (in `main.tsx`): the build replaces `import.meta.env.VITE_PREVIEW` with a literal, so
 *   when the variable is not set, the whole preview branch is dead and neither MSW nor the fixtures
 *   (~200 kB) reach the production build. Measured: without it `startPreview` really got there.
 * - **the decision** (here): a comparison with the LIST of switching-on values — readable and testable
 *   on its own, without the bundle size hanging on it.
 *
 * ⚠️ **Never by truthiness and never against a single word.** Both mistakes have happened:
 * - a single word missed the value and the preview never switched on (ICCINT-93);
 * - a truthiness check has the opposite fault — in JavaScript the string `"false"` is truthy too, so
 *   `VITE_PREVIEW=false` would switch the preview ON (ICCINT-95). And the habit of switching off with
 *   the word "false" is alive.
 *
 * The pattern comes from the NEX Manager 1.2.0 build, where the agent designed it better than the
 * original template.
 */

/** The values that switch the preview ON — and nothing else. `false`, `0`, `off` or empty do not. */
const ENABLING_VALUES = ["1", "true", "yes", "on"];

export function isPreviewEnabled(
  value: string | undefined = import.meta.env.VITE_PREVIEW,
): boolean {
  return typeof value === "string" && ENABLING_VALUES.includes(value);
}
