#!/usr/bin/env node
// DEV-394 — no text a person reads is written into the app's code; every one comes from the catalogs (src/locales).
//
//   npx nex-check-texts src          (exit 1 and the texts, one per line, when it finds any)
//
// The rule reads the source as TypeScript sees it: text between JSX tags, a text attribute (placeholder, title,
// aria-label, alt, label), a string shown as a JSX child, a fallback sentence after `||` / `??`, a string handed to a
// setter of what a person reads (setError…), and any string with a Slovak letter. Class names, keys and technical values
// are none of these. Left out: tests, the catalogs (locales/), and a file that says on its first line it speaks to the
// agent who builds the app (`// texts: for the agent`) — the manifest's sentences, a preview's sample data. The same
// rule guards nex-shared (test/no-text-outside-catalogs.test.mjs). The cockpit runs it when it verifies a version of a
// project that speaks more than one language (DEV-395).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative } from "node:path";

const ts = createRequire(join(process.cwd(), "noop.js"))("typescript");

export const AGENT_MARK = "// texts: for the agent";
const TEXT_ATTRIBUTES = new Set(["placeholder", "title", "aria-label", "alt", "label"]);
const LETTER = /\p{L}/u;
const SLOVAK = /[áäčďéíĺľňóôŕšťúýž]/i;
const SENTENCE = /\p{L}{2,}[\s\p{L}]*\s\p{L}{2,}/u;

export function sourcesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return ["test", "tests", "__tests__", "locales", "node_modules"].includes(name) ? [] : sourcesUnder(path);
    return /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith(".d.ts") ? [path] : [];
  });
}

function toldToAPerson(node) {
  let at = node.parent;
  if (ts.isConditionalExpression(at)) at = at.parent;
  return ts.isCallExpression(at) && /^set\w*(Error|Message|Result|Notice)$/.test(at.expression.getText());
}

/** The texts written into one source file — `[line, what, text]`. */
export function hardTexts(name, code) {
  if (code.trimStart().startsWith(AGENT_MARK)) return [];
  const file = ts.createSourceFile(name, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const line = (node) => file.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const isString = (node) => ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
  const visit = (node) => {
    if (ts.isJsxText(node) && LETTER.test(node.text)) found.push([line(node), "JSX text", node.text.trim()]);
    if (ts.isJsxAttribute(node) && node.initializer && isString(node.initializer) && TEXT_ATTRIBUTES.has(node.name.getText()) && LETTER.test(node.initializer.text)) {
      found.push([line(node), node.name.getText(), node.initializer.text]);
    }
    if (isString(node) && !ts.isImportDeclaration(node.parent) && !ts.isExportDeclaration(node.parent)) {
      const parent = node.parent;
      const shownAsChild = ts.isJsxExpression(parent) && !ts.isJsxAttribute(parent.parent) && LETTER.test(node.text);
      const inChildCondition = ts.isConditionalExpression(parent) && ts.isJsxExpression(parent.parent) && !ts.isJsxAttribute(parent.parent.parent) && LETTER.test(node.text);
      const fallback = ts.isBinaryExpression(parent) && parent.right === node && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind) && SENTENCE.test(node.text);
      if (shownAsChild || inChildCondition || fallback || (toldToAPerson(node) && LETTER.test(node.text)) || SLOVAK.test(node.text)) {
        found.push([line(node), "string", node.text]);
      }
    }
    if (ts.isTemplateExpression(node) && SLOVAK.test(node.getText())) found.push([line(node), "template", node.getText()]);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** Every hard text under `dir`, as `file:line (what): text`. */
export function check(dir) {
  return sourcesUnder(dir).flatMap((path) =>
    hardTexts(path, readFileSync(path, "utf8")).map(([l, what, text]) => `${relative(process.cwd(), path)}:${l} (${what}): ${text.slice(0, 80)}`),
  );
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("nex-check-texts")) {
  const found = check(process.argv[2] ?? "src");
  for (const one of found) console.log(one);
  if (found.length) {
    console.error(`${found.length} texts are written into the code instead of the catalogs (src/locales).`);
    process.exit(1);
  }
}
