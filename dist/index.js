import {
  ADMIN_ROLE,
  PASSWORD_MIN_LENGTH,
  STANDARD_ENDPOINTS,
  STANDARD_ROLES,
  createStandardApi
} from "./chunk-33ECZEVM.js";

// src/manifest.ts
import { createTranslator, LANGUAGES } from "nex-shared";

// src/modules.ts
var MODULES = Object.freeze({});

// src/templates/ids.ts
var TEMPLATE_IDS = ["nsv-standard"];

// src/manifest.ts
var TEMPLATE_PATHS = ["/", "/getting-started", "/updates", "/settings"];
var NAV_LABEL_MAX = 22;
var ManifestError = class extends Error {
  problems;
  constructor(problems) {
    super(`Manifest aplik\xE1cie nie je v poriadku:
- ${problems.join("\n- ")}`);
    this.name = "ManifestError";
    this.problems = problems;
  }
};
var AUTH_MODES = ["password", "manager"];
function defineApp(input, extras = {}) {
  const problems = [];
  const ai = input.ai ?? false;
  const modules = input.modules ?? [];
  const counts = extras.counts ?? {};
  const { "/": overviewVisible, ...visible } = extras.visible ?? {};
  const nav = (input.nav ?? []).map((entry) => ({
    ...entry,
    ...counts[entry.path] ? { useCount: counts[entry.path] } : {},
    ...visible[entry.path] ? { useVisible: visible[entry.path] } : {}
  }));
  if (!TEMPLATE_IDS.includes(input.template)) {
    problems.push(`\u0160abl\xF3na \u201E${input.template}\u201C neexistuje \u2014 s\xFA tieto: ${TEMPLATE_IDS.join(", ")}.`);
  }
  if (!input.name || !input.name.trim()) problems.push("Ch\xFDba n\xE1zov aplik\xE1cie (name).");
  const initials = input.initials ?? "";
  if (initials.length < 1 || initials.length > 4) {
    problems.push(`Inici\xE1ly (initials) maj\xFA 1 a\u017E 4 znaky \u2014 \u201E${initials}\u201C m\xE1 ${initials.length}.`);
  }
  if (!AUTH_MODES.includes(input.auth)) {
    problems.push(
      `Sp\xF4sob prihl\xE1senia (auth) je \u201Epassword\u201C (vlastn\xE9 heslo) alebo \u201Emanager\u201C (spustenie z NEX Managera), nie \u201E${input.auth}\u201C.`
    );
  }
  if (ai) {
    if (!ai.roles || ai.roles.length === 0) problems.push("Aplik\xE1cia s AI (ai) menuje aspo\u0148 jednu rolu agenta.");
    for (const id of duplicates((ai.roles ?? []).map((r) => r.id))) problems.push(`Rola agenta \u201E${id}\u201C je uveden\xE1 dvakr\xE1t.`);
  }
  const available = Object.keys(MODULES);
  for (const id of modules) {
    if (!MODULES[id]) {
      problems.push(
        `Volite\u013En\xFD modul \u201E${id}\u201C \u0161abl\xF3na zatia\u013E nem\xE1 \u2014 dostupn\xE9: ${available.length ? available.join(", ") : "\u017Eiadne"}.`
      );
    }
  }
  const shownIn = (input.languages ?? ["sk"]).filter((code) => LANGUAGES.some((l) => l.code === code));
  for (const entry of nav) {
    for (const shown of new Set(shownIn.map((code) => createTranslator(code, extras.messages ?? {})(entry.label)))) {
      if ([...shown].length > NAV_LABEL_MAX) {
        problems.push(`Polo\u017Eka \u201E${shown}\u201C m\xE1 ${[...shown].length} znakov \u2014 v \u013Eavom paneli sa zmest\xED najviac ${NAV_LABEL_MAX}.`);
      }
    }
    if (!entry.icon || !entry.icon.trim()) problems.push(`Polo\u017Eka \u201E${entry.label}\u201C nem\xE1 ikonu.`);
    if (!entry.path.startsWith("/")) {
      problems.push(`Polo\u017Eka \u201E${entry.label}\u201C: cesta \u201E${entry.path}\u201C mus\xED za\u010D\xEDna\u0165 lomkou.`);
    } else if (TEMPLATE_PATHS.includes(entry.path)) {
      problems.push(
        `Polo\u017Eka \u201E${entry.label}\u201C: cesta \u201E${entry.path}\u201C patr\xED \u0161abl\xF3ne (Preh\u013Ead, Ako za\u010Da\u0165, Aktualiz\xE1cie, Nastavenia).`
      );
    }
  }
  for (const label of duplicates(nav.map((n) => n.label))) problems.push(`Polo\u017Eka \u201E${label}\u201C je v \u013Eavom paneli dvakr\xE1t.`);
  for (const path of duplicates(nav.map((n) => n.path))) problems.push(`Cesta \u201E${path}\u201C je v \u013Eavom paneli dvakr\xE1t.`);
  for (const path of Object.keys(visible)) {
    if (!nav.some((n) => n.path === path)) {
      problems.push(`Vidite\u013Enos\u0165 pre \u201E${path}\u201C nepatr\xED \u017Eiadnej polo\u017Eke \u013Eav\xE9ho panela.`);
    }
  }
  for (const path of Object.keys(counts)) {
    if (!nav.some((n) => n.path === path)) problems.push(`Po\u010Det pre \u201E${path}\u201C nepatr\xED \u017Eiadnej polo\u017Eke \u013Eav\xE9ho panela.`);
  }
  const languages = input.languages ?? ["sk"];
  const known = LANGUAGES.map((l) => l.code);
  if (languages.length === 0) problems.push("Zoznam jazykov (languages) je pr\xE1zdny \u2014 aplik\xE1cia hovor\xED aspo\u0148 jedn\xFDm.");
  for (const code of languages) {
    if (!known.includes(code)) problems.push(`Jazyk \u201E${code}\u201C \u0161abl\xF3na nepozn\xE1 \u2014 pozn\xE1 tieto: ${known.join(", ")}.`);
  }
  for (const code of duplicates(languages)) problems.push(`Jazyk \u201E${code}\u201C je uveden\xFD dvakr\xE1t.`);
  const messages = extras.messages ?? {};
  const main = languages[0];
  for (const key of Object.keys((main && messages[main]) ?? {})) {
    for (const code of languages.slice(1)) {
      if (!(key in (messages[code] ?? {}))) problems.push(`Text \u201E${key}\u201C nem\xE1 preklad v jazyku \u201E${code}\u201C.`);
    }
  }
  if (problems.length) throw new ManifestError(problems);
  return Object.freeze({
    template: input.template,
    name: input.name,
    initials: input.initials,
    auth: input.auth,
    ai: ai ? Object.freeze({ roles: Object.freeze([...ai.roles]) }) : false,
    modules: Object.freeze([...modules]),
    nav: Object.freeze([...nav]),
    settings: Object.freeze({ categories: Object.freeze([...input.settings?.categories ?? []]) }),
    ...extras.userActions ? { userActions: extras.userActions } : {},
    ...overviewVisible ? { overviewVisible } : {},
    languages: Object.freeze([...languages]),
    messages
  });
}
function duplicates(values) {
  const seen = /* @__PURE__ */ new Set();
  const twice = /* @__PURE__ */ new Set();
  for (const v of values) (seen.has(v) ? twice : seen).add(v);
  return [...twice];
}

// src/TemplateApp.tsx
import { useCallback as useCallback4, useEffect as useEffect8, useMemo as useMemo4, useState as useState8 } from "react";
import { ApiError, createApiClient, I18nProvider, onServerChange, registerAuthCallback } from "nex-shared";

// src/frame/FrameContext.ts
import { createContext, useContext } from "react";
var FrameContext = createContext(null);
function useFrame() {
  const frame = useContext(FrameContext);
  if (!frame) throw new Error("useFrame must be used inside <TemplateApp>");
  return frame;
}

// src/frame/layoutStore.ts
import { createStore } from "zustand/vanilla";
function createLayoutStore(api) {
  return createStore()((set, get) => ({
    layout: null,
    load: async () => {
      try {
        set({ layout: await api.getLayout() });
      } catch {
      }
    },
    save: async (changes) => {
      const before = get().layout;
      if (before) set({ layout: { ...before, ...changes } });
      try {
        set({ layout: await api.saveLayout(changes) });
      } catch {
        set({ layout: before });
      }
    },
    reset: () => set({ layout: null })
  }));
}

// src/frame/screens.tsx
import { useState as useState2 } from "react";
import { Brand, Button, Card, LoginForm, PasswordInput } from "nex-shared";

// src/frame/installation.tsx
import { createContext as createContext2, useContext as useContext2, useEffect, useState } from "react";

// src/i18n.ts
import { useMemo } from "react";
import { createTranslator as createTranslator2, useLanguage, useT } from "nex-shared";

// src/locales/en.ts
var kitEn = {
  "kit.back.to": "Back to: {screen}",
  "kit.error.reload": "Reload",
  "kit.error.text": "This page could not be shown. Try reloading it; if it happens again, tell the app's administrator.",
  "kit.error.title": "\u26A0\uFE0F The page ran into an error",
  "kit.guide.failed": "The guide could not be loaded:",
  "kit.guide.none": "The app's guide has not been written yet.",
  "kit.guide.noServer": "the server does not answer",
  "kit.login.failed": "Signing in did not succeed.",
  "kit.login.identity": "Username",
  "kit.login.loading": "Signing in\u2026",
  "kit.notFound.back": "Back to Overview",
  "kit.notFound.text": "There is nothing at this address. Perhaps it changed, or it was mistyped.",
  "kit.notFound.title": "The page does not exist",
  "kit.password.failed": "Changing the password did not succeed.",
  "kit.password.mismatch": "The new passwords do not match.",
  "kit.password.submit": "Set password",
  "kit.password.title": "Set your own password",
  "kit.password.why": "Someone else set your password for the first sign-in. Until you set your own, the app will not open.",
  "kit.place.gettingStarted": "Getting started",
  "kit.place.overview": "Overview",
  "kit.place.settings": "Settings",
  "kit.place.updates": "Updates",
  "kit.retry": "Try again",
  "kit.role.admin": "Administrator",
  "kit.role.user": "User",
  "kit.settings.agentsLoadFailed": "The agents' settings could not be loaded.",
  "kit.settings.email": "E-mail",
  "kit.settings.fullName": "Full name",
  "kit.settings.loadFailed": "The settings could not be loaded.",
  "kit.settings.loginCategory": "Sign-in",
  "kit.settings.loginCategoryHint": "How long a person stays signed in.",
  "kit.settings.managedByManager": "Your account is managed by NEX Manager \u2014 your name, e-mail and password are changed there.",
  "kit.settings.saveFailed": "Saving failed.",
  "kit.settings.sessionsHint": "Who is signed in and since when. A revoked session stops working at once.",
  "kit.settings.sessionsLoadFailed": "The sessions could not be loaded.",
  "kit.settings.signedInAs": "Signed in as",
  "kit.signedOut.managerExpired": "The sign-in has expired. Open the app again from NEX Manager.",
  "kit.signedOut.managerLogout": "You have been signed out. You can open the app again from NEX Manager.",
  "kit.signedOut.passwordExpired": "The sign-in has expired. Sign in again.",
  "kit.uat": "Test environment (UAT)",
  "kit.unavailable": "The app does not answer right now. Try again in a moment.",
  "kit.updates.failed": "Loading the updates failed."
};

// src/locales/hu.ts
var kitHu = {
  "kit.back.to": "Vissza ide: {screen}",
  "kit.error.reload": "Friss\xEDt\xE9s",
  "kit.error.text": "Ezt az oldalt nem siker\xFClt megjelen\xEDteni. Pr\xF3b\xE1ld friss\xEDteni; ha ism\xE9tl\u0151dik, sz\xF3lj az alkalmaz\xE1s rendszergazd\xE1j\xE1nak.",
  "kit.error.title": "\u26A0\uFE0F Hiba t\xF6rt\xE9nt az oldalon",
  "kit.guide.failed": "Az \xFAtmutat\xF3t nem siker\xFClt bet\xF6lteni:",
  "kit.guide.none": "Az alkalmaz\xE1s \xFAtmutat\xF3ja m\xE9g nincs meg\xEDrva.",
  "kit.guide.noServer": "a szerver nem v\xE1laszol",
  "kit.login.failed": "A bejelentkez\xE9s nem siker\xFClt.",
  "kit.login.identity": "Felhaszn\xE1l\xF3n\xE9v",
  "kit.login.loading": "Bejelentkez\xE9s\u2026",
  "kit.notFound.back": "Vissza az \xE1ttekint\xE9shez",
  "kit.notFound.text": "Ezen a c\xEDmen nincs semmi. Lehet, hogy megv\xE1ltozott, vagy el\xEDrt\xE1k.",
  "kit.notFound.title": "Az oldal nem l\xE9tezik",
  "kit.password.failed": "A jelsz\xF3 m\xF3dos\xEDt\xE1sa nem siker\xFClt.",
  "kit.password.mismatch": "Az \xFAj jelszavak nem egyeznek.",
  "kit.password.submit": "Jelsz\xF3 be\xE1ll\xEDt\xE1sa",
  "kit.password.title": "\xC1ll\xEDtsd be a saj\xE1t jelszavadat",
  "kit.password.why": "Az els\u0151 bejelentkez\xE9shez a jelsz\xF3t valaki m\xE1s \xE1ll\xEDtotta be neked. Am\xEDg nem \xE1ll\xEDtasz be saj\xE1tot, az alkalmaz\xE1s nem ny\xEDlik meg.",
  "kit.place.gettingStarted": "Els\u0151 l\xE9p\xE9sek",
  "kit.place.overview": "\xC1ttekint\xE9s",
  "kit.place.settings": "Be\xE1ll\xEDt\xE1sok",
  "kit.place.updates": "Friss\xEDt\xE9sek",
  "kit.retry": "\xDAjra",
  "kit.role.admin": "Rendszergazda",
  "kit.role.user": "Felhaszn\xE1l\xF3",
  "kit.settings.agentsLoadFailed": "Az \xFCgyn\xF6k\xF6k be\xE1ll\xEDt\xE1sait nem siker\xFClt bet\xF6lteni.",
  "kit.settings.email": "E-mail",
  "kit.settings.fullName": "N\xE9v",
  "kit.settings.loadFailed": "A be\xE1ll\xEDt\xE1sokat nem siker\xFClt bet\xF6lteni.",
  "kit.settings.loginCategory": "Bejelentkez\xE9s",
  "kit.settings.loginCategoryHint": "Meddig marad bejelentkezve egy felhaszn\xE1l\xF3.",
  "kit.settings.managedByManager": "A fi\xF3kodat a NEX Manager kezeli \u2014 a nevet, az e-mail-c\xEDmet \xE9s a jelsz\xF3t ott m\xF3dos\xEDthatod.",
  "kit.settings.saveFailed": "A ment\xE9s nem siker\xFClt.",
  "kit.settings.sessionsHint": "Ki van bejelentkezve, \xE9s mi\xF3ta. A megsz\xFCntetett munkamenet azonnal \xE9rv\xE9ny\xE9t veszti.",
  "kit.settings.sessionsLoadFailed": "A munkameneteket nem siker\xFClt bet\xF6lteni.",
  "kit.settings.signedInAs": "Bejelentkezve:",
  "kit.signedOut.managerExpired": "A bejelentkez\xE9s lej\xE1rt. Nyisd meg \xFAjra az alkalmaz\xE1st a NEX Managerb\u0151l.",
  "kit.signedOut.managerLogout": "Kijelentkezt\xE9l. Az alkalmaz\xE1st \xFAjra a NEX Managerb\u0151l nyithatod meg.",
  "kit.signedOut.passwordExpired": "A bejelentkez\xE9s lej\xE1rt. Jelentkezz be \xFAjra.",
  "kit.uat": "Tesztk\xF6rnyezet (UAT)",
  "kit.unavailable": "Az alkalmaz\xE1s most nem v\xE1laszol. Pr\xF3b\xE1ld \xFAjra egy kicsit k\xE9s\u0151bb.",
  "kit.updates.failed": "A friss\xEDt\xE9sek bet\xF6lt\xE9se nem siker\xFClt."
};

// src/locales/sk.ts
var kitSk = {
  "kit.back.to": "Sp\xE4\u0165 na: {screen}",
  "kit.error.reload": "Obnovi\u0165",
  "kit.error.text": "T\xFAto str\xE1nku sa nepodarilo zobrazi\u0165. Sk\xFAs ju obnovi\u0165; ak sa to opakuje, povedz o tom spr\xE1vcovi aplik\xE1cie.",
  "kit.error.title": "\u26A0\uFE0F Str\xE1nka narazila na chybu",
  "kit.guide.failed": "N\xE1vod sa nepodarilo na\u010D\xEDta\u0165:",
  "kit.guide.none": "N\xE1vod k aplik\xE1cii e\u0161te nie je nap\xEDsan\xFD.",
  "kit.guide.noServer": "server neodpoved\xE1",
  "kit.login.failed": "Prihl\xE1senie sa nepodarilo.",
  "kit.login.identity": "Prihlasovacie meno",
  "kit.login.loading": "Prihlasujem\u2026",
  "kit.notFound.back": "Sp\xE4\u0165 na Preh\u013Ead",
  "kit.notFound.text": "Na tejto adrese ni\u010D nie je. Mo\u017Eno sa zmenila, alebo bola zle nap\xEDsan\xE1.",
  "kit.notFound.title": "Str\xE1nka neexistuje",
  "kit.password.failed": "Zmena hesla sa nepodarila.",
  "kit.password.mismatch": "Nov\xE9 hesl\xE1 sa nezhoduj\xFA.",
  "kit.password.submit": "Nastavi\u0165 heslo",
  "kit.password.title": "Nastav si vlastn\xE9 heslo",
  "kit.password.why": "Heslo na prv\xE9 prihl\xE1senie ti nastavil niekto in\xFD. K\xFDm si nastav\xED\u0161 vlastn\xE9, aplik\xE1cia sa neotvor\xED.",
  "kit.place.gettingStarted": "Ako za\u010Da\u0165",
  "kit.place.overview": "Preh\u013Ead",
  "kit.place.settings": "Nastavenia",
  "kit.place.updates": "Aktualiz\xE1cie",
  "kit.retry": "Sk\xFAsi\u0165 znova",
  "kit.role.admin": "Spr\xE1vca",
  "kit.role.user": "Pou\u017E\xEDvate\u013E",
  "kit.settings.agentsLoadFailed": "Nepodarilo sa na\u010D\xEDta\u0165 nastavenia agentov.",
  "kit.settings.email": "E-mail",
  "kit.settings.fullName": "Meno a priezvisko",
  "kit.settings.loadFailed": "Nepodarilo sa na\u010D\xEDta\u0165 nastavenia.",
  "kit.settings.loginCategory": "Prihl\xE1senie",
  "kit.settings.loginCategoryHint": "Ako dlho ost\xE1va \u010Dlovek prihl\xE1sen\xFD.",
  "kit.settings.managedByManager": "Tvoj \xFA\u010Det spravuje NEX Manager \u2014 meno, e-mail aj heslo sa menia tam.",
  "kit.settings.saveFailed": "Ulo\u017Eenie zlyhalo.",
  "kit.settings.sessionsHint": "Kto je prihl\xE1sen\xFD a odkedy. Zru\u0161en\xE1 rel\xE1cia prestane plati\u0165 hne\u010F.",
  "kit.settings.sessionsLoadFailed": "Nepodarilo sa na\u010D\xEDta\u0165 rel\xE1cie.",
  "kit.settings.signedInAs": "Prihl\xE1sen\xFD ako",
  "kit.signedOut.managerExpired": "Prihl\xE1senie vypr\u0161alo. Aplik\xE1ciu otvor znova z NEX Managera.",
  "kit.signedOut.managerLogout": "Odhl\xE1senie prebehlo. Aplik\xE1ciu otvor\xED\u0161 znova z NEX Managera.",
  "kit.signedOut.passwordExpired": "Prihl\xE1senie vypr\u0161alo. Prihl\xE1s sa znova.",
  "kit.uat": "Sk\xFA\u0161obn\xE9 prostredie (UAT)",
  "kit.unavailable": "Aplik\xE1cia teraz neodpoved\xE1. Sk\xFAs to o chv\xED\u013Eu znova.",
  "kit.updates.failed": "Na\u010D\xEDtanie aktualiz\xE1ci\xED zlyhalo."
};

// src/i18n.ts
var KIT_MESSAGES = { sk: kitSk, hu: kitHu, en: kitEn };
function mergeMessages(app) {
  const merged = {};
  for (const language of /* @__PURE__ */ new Set([...Object.keys(KIT_MESSAGES), ...Object.keys(app ?? {})])) {
    merged[language] = { ...KIT_MESSAGES[language], ...app?.[language] };
  }
  return merged;
}
function useKitT() {
  const t = useT();
  const { language } = useLanguage();
  return useMemo(() => {
    const kit = createTranslator2(language, KIT_MESSAGES);
    return (key, params) => {
      const said = t(key, params);
      return said === key ? kit(key, params) : said;
    };
  }, [t, language]);
}
function chooseLanguage(offered, personal, installation) {
  for (const candidate of [personal, installation]) {
    if (candidate && offered.includes(candidate)) return candidate;
  }
  return offered[0] ?? "sk";
}

// src/frame/installation.tsx
import { jsx } from "react/jsx-runtime";
var INSTALLATION_MANIFEST = "/api/v1/installation/manifest.webmanifest";
var UAT_SENTENCE = "kit.uat";
function installationTitle(appName, installation) {
  const customer = installation?.customer;
  const title = customer ? `${appName} \u2014 ${customer}` : appName;
  return installation?.environment === "uat" ? `${title} (UAT)` : title;
}
function useInstallation(api) {
  const [installation, setInstallation] = useState(null);
  useEffect(() => {
    let live = true;
    api.installation().then((answer) => live && setInstallation(answer)).catch(() => void 0);
    return () => {
      live = false;
    };
  }, [api]);
  return installation;
}
function useInstallationWindow(appName, installation) {
  useEffect(() => {
    document.title = installationTitle(appName, installation);
    if (!installation?.customer && !installation?.environment) return;
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = INSTALLATION_MANIFEST;
  }, [appName, installation]);
}
var InstallationContext = createContext2(null);
function useInstallationIdentity() {
  return useContext2(InstallationContext);
}
function InstallationBand() {
  const t = useKitT();
  const installation = useInstallationIdentity();
  if (installation?.environment !== "uat") return null;
  return /* @__PURE__ */ jsx(
    "div",
    {
      role: "status",
      className: "flex-shrink-0 truncate border-b border-[var(--color-status-warning)] bg-[var(--color-state-warning-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-state-warning-fg)]",
      children: installation.customer ? `${t(UAT_SENTENCE)} \u2014 ${installation.customer}` : t(UAT_SENTENCE)
    }
  );
}
function InstallationUat() {
  const t = useKitT();
  const installation = useInstallationIdentity();
  if (installation?.environment !== "uat") return null;
  return /* @__PURE__ */ jsx("p", { className: "mt-2 inline-block rounded border border-[var(--color-status-warning)] bg-[var(--color-state-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-state-warning-fg)]", children: t(UAT_SENTENCE) });
}
function InstallationCustomer({ className = "" }) {
  const installation = useInstallationIdentity();
  if (!installation?.customer) return null;
  return /* @__PURE__ */ jsx("p", { className: `truncate text-xs font-semibold text-[var(--color-text-secondary)] ${className}`.trim(), title: installation.customer, children: installation.customer });
}

// src/frame/people.ts
import { createTranslator as createTranslator3 } from "nex-shared";
function personName(person) {
  if (!person) return "";
  const full = [person.first_name, person.last_name].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
  return full || person.username;
}
function roleLabel(role, t = SLOVAK) {
  if (!role) return "\u2014";
  const key = STANDARD_ROLES.find((r) => r.value === role)?.label;
  return key ? t(key) : role;
}
var SLOVAK = createTranslator3("sk", KIT_MESSAGES);
function errorText(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// src/frame/screens.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function Centered({ manifest, children }) {
  return /* @__PURE__ */ jsx2("div", { className: "flex min-h-full items-center justify-center bg-[var(--color-canvas)] p-6", children: /* @__PURE__ */ jsxs(Card, { className: "w-full max-w-sm", children: [
    /* @__PURE__ */ jsxs("div", { className: "mb-5", children: [
      /* @__PURE__ */ jsx2(Brand, { initials: manifest.initials, name: manifest.name }),
      /* @__PURE__ */ jsx2(InstallationCustomer, { className: "mt-2" }),
      /* @__PURE__ */ jsx2(InstallationUat, {})
    ] }),
    children
  ] }) });
}
function LoadingScreen() {
  const t = useKitT();
  return /* @__PURE__ */ jsx2("div", { className: "flex min-h-full items-center justify-center bg-[var(--color-canvas)] text-sm text-[var(--color-text-muted)]", children: t("common.loading") });
}
function LoginScreen({
  manifest,
  api,
  note,
  onSignedIn
}) {
  const t = useKitT();
  const [busy, setBusy] = useState2(false);
  const [error, setError] = useState2(null);
  async function signIn({ username, password }) {
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.login(username, password));
    } catch (e) {
      setError(errorText(e, t("kit.login.failed")));
      setBusy(false);
    }
  }
  return /* @__PURE__ */ jsxs(Centered, { manifest, children: [
    note && /* @__PURE__ */ jsx2("p", { className: "mb-4 text-sm text-[var(--color-text-secondary)]", children: note }),
    /* @__PURE__ */ jsx2(
      LoginForm,
      {
        onSubmit: signIn,
        loading: busy,
        error,
        onChange: () => setError(null),
        autoFocus: true,
        identityLabel: t("kit.login.identity"),
        passwordLabel: t("login.password"),
        submitLabel: t("login.submit"),
        loadingLabel: t("kit.login.loading")
      }
    )
  ] });
}
function ClosedScreen({ manifest, sentence }) {
  return /* @__PURE__ */ jsx2(Centered, { manifest, children: /* @__PURE__ */ jsx2("p", { className: "text-sm text-[var(--color-text-secondary)]", children: sentence }) });
}
function UnavailableScreen({ manifest, onRetry }) {
  const t = useKitT();
  return /* @__PURE__ */ jsxs(Centered, { manifest, children: [
    /* @__PURE__ */ jsx2("p", { className: "mb-4 text-sm text-[var(--color-text-secondary)]", children: t("kit.unavailable") }),
    /* @__PURE__ */ jsx2(Button, { onClick: onRetry, children: t("kit.retry") })
  ] });
}
function ChangePasswordScreen({
  manifest,
  api,
  onChanged,
  onLogout
}) {
  const t = useKitT();
  const [next, setNext] = useState2("");
  const [again, setAgain] = useState2("");
  const [busy, setBusy] = useState2(false);
  const [error, setError] = useState2("");
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (next !== again) {
      setError(t("kit.password.mismatch"));
      return;
    }
    setBusy(true);
    try {
      await api.changePassword("", next);
      onChanged();
    } catch (err) {
      setError(errorText(err, t("kit.password.failed")));
      setBusy(false);
    }
  }
  const label = "mb-1 block text-xs text-[var(--color-text-muted)]";
  return /* @__PURE__ */ jsxs(Centered, { manifest, children: [
    /* @__PURE__ */ jsx2("h1", { className: "mb-1 text-base font-semibold text-[var(--color-text-primary)]", children: t("kit.password.title") }),
    /* @__PURE__ */ jsx2("p", { className: "mb-4 text-sm text-[var(--color-text-secondary)]", children: t("kit.password.why") }),
    /* @__PURE__ */ jsxs("form", { onSubmit: submit, className: "space-y-3", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx2("label", { htmlFor: "kit-new", className: label, children: t("password.new") }),
        /* @__PURE__ */ jsx2(
          PasswordInput,
          {
            id: "kit-new",
            reveal: true,
            revealLabel: t("password.new"),
            value: next,
            onChange: (e) => setNext(e.target.value)
          }
        )
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx2("label", { htmlFor: "kit-again", className: label, children: t("account.repeatPassword") }),
        /* @__PURE__ */ jsx2(
          PasswordInput,
          {
            id: "kit-again",
            reveal: true,
            revealLabel: t("account.repeatPassword"),
            value: again,
            onChange: (e) => setAgain(e.target.value)
          }
        )
      ] }),
      error && /* @__PURE__ */ jsx2("p", { role: "alert", className: "text-sm text-[var(--color-status-error)]", children: error }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-3 pt-1", children: [
        /* @__PURE__ */ jsx2("button", { type: "button", onClick: onLogout, className: "text-xs text-[var(--color-text-muted)] hover:underline", children: t("user.logout") }),
        /* @__PURE__ */ jsx2(Button, { type: "submit", disabled: busy || !next || !again, children: busy ? t("common.saving") : t("kit.password.submit") })
      ] })
    ] })
  ] });
}

// src/frame/theme.tsx
import { createContext as createContext3, useCallback, useContext as useContext3, useEffect as useEffect2, useMemo as useMemo2, useState as useState3 } from "react";
import { jsx as jsx3 } from "react/jsx-runtime";
var ThemeContext = createContext3(null);
function darkModeKey(username) {
  return `nex_dark_${username}`;
}
function readDark(username) {
  if (!username) return true;
  try {
    const stored = window.localStorage.getItem(darkModeKey(username));
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}
function ThemeProvider({ username, children }) {
  const [isDark, setIsDark] = useState3(() => readDark(username));
  useEffect2(() => setIsDark(readDark(username)), [username]);
  useEffect2(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);
  const toggleDark = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      if (username) {
        try {
          window.localStorage.setItem(darkModeKey(username), String(next));
        } catch {
        }
      }
      return next;
    });
  }, [username]);
  const value = useMemo2(() => ({ isDark, toggleDark }), [isDark, toggleDark]);
  return /* @__PURE__ */ jsx3(ThemeContext.Provider, { value, children });
}
function useTheme() {
  const value = useContext3(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <TemplateApp>");
  return value;
}

// src/templates/nsv-standard/NsvStandard.tsx
import { Navigate, Outlet as Outlet2, Route, Routes } from "react-router-dom";

// src/templates/nsv-standard/pages/GettingStartedPage.tsx
import { useEffect as useEffect3, useState as useState4 } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Page } from "nex-shared";
import { jsx as jsx4, jsxs as jsxs2 } from "react/jsx-runtime";
var PROSE = `prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold
  prose-h1:text-lg prose-h2:text-base prose-h2:text-primary-500 prose-h2:mt-6 prose-h2:mb-2 prose-h3:text-base
  prose-p:text-[var(--color-text-secondary)] prose-p:leading-relaxed prose-strong:text-[var(--color-text-primary)]
  prose-li:text-[var(--color-text-secondary)] prose-li:marker:text-primary-500`;
function GettingStartedPage() {
  const t = useKitT();
  const { api } = useFrame();
  const [markdown, setMarkdown] = useState4(null);
  const [error, setError] = useState4("");
  useEffect3(() => {
    let live = true;
    api.gettingStarted().then((g) => live && setMarkdown(g.markdown ?? "")).catch((e) => live && setError(errorText(e, t("kit.guide.noServer"))));
    return () => {
      live = false;
    };
  }, [api, t]);
  return /* @__PURE__ */ jsx4(Page, { title: t("kit.place.gettingStarted"), width: "narrow", children: error ? /* @__PURE__ */ jsxs2("p", { className: "text-sm text-[var(--color-status-error)]", children: [
    t("kit.guide.failed"),
    " ",
    error
  ] }) : markdown === null ? /* @__PURE__ */ jsx4("p", { className: "text-sm text-[var(--color-text-muted)]", children: t("common.loading") }) : markdown.trim() === "" ? /* @__PURE__ */ jsx4("p", { className: "text-sm text-[var(--color-text-muted)]", children: t("kit.guide.none") }) : /* @__PURE__ */ jsx4("div", { className: PROSE, children: /* @__PURE__ */ jsx4(ReactMarkdown, { remarkPlugins: [remarkGfm], children: markdown }) }) });
}

// src/templates/nsv-standard/pages/NotFoundPage.tsx
import { Link } from "react-router-dom";
import { Page as Page2 } from "nex-shared";
import { jsx as jsx5, jsxs as jsxs3 } from "react/jsx-runtime";
function NotFoundPage() {
  const t = useKitT();
  return /* @__PURE__ */ jsxs3(Page2, { title: t("kit.notFound.title"), width: "narrow", children: [
    /* @__PURE__ */ jsx5("p", { className: "text-sm text-[var(--color-text-secondary)]", children: t("kit.notFound.text") }),
    /* @__PURE__ */ jsx5(Link, { to: "/", className: "mt-3 inline-block text-sm text-[var(--color-accent-primary)] hover:underline", children: t("kit.notFound.back") })
  ] });
}

// src/templates/nsv-standard/pages/SettingsPage.tsx
import { useCallback as useCallback2, useEffect as useEffect4, useMemo as useMemo3, useState as useState5 } from "react";
import {
  AgentsPanel,
  Card as Card2,
  MyAccountPanel,
  SessionsPanel,
  SettingsShell,
  SystemSettingsPanel,
  UsersPanel,
  useLanguage as useLanguage2
} from "nex-shared";
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var EFFORTS = ["low", "medium", "high", "xhigh", "max"];
var USER_FIELDS = { username: true, names: true, telegram: false, passwordMinLength: PASSWORD_MIN_LENGTH };
var KIT_SETTINGS_CATEGORIES = [
  {
    id: "kit-auth",
    // DEV-394: keys of the template's catalogs, said in the person's language where the panel draws them.
    label: "kit.settings.loginCategory",
    description: "kit.settings.loginCategoryHint",
    prefixes: ["auth_"]
  }
];
function settingsConfig(manifest) {
  const tabs = ["system"];
  if (manifest.ai) tabs.push("agents");
  tabs.push("konto");
  if (manifest.auth === "password") tabs.push("users");
  tabs.push("sessions");
  return {
    tabs,
    // DEV-394: the tabs are named by nex-shared, in the person's language.
    labels: {},
    tabVisibleForRole: (tab, role) => tab === "users" || tab === "agents" ? role === ADMIN_ROLE : true
  };
}
function SystemTab() {
  const t = useKitT();
  const { api, manifest, isAdmin } = useFrame();
  const [settings, setSettings] = useState5([]);
  const [loading, setLoading] = useState5(true);
  const [loadError, setLoadError] = useState5("");
  useEffect4(() => {
    api.listSystemSettings().then(setSettings).catch((e) => setLoadError(errorText(e, t("kit.settings.loadFailed")))).finally(() => setLoading(false));
  }, [api, t]);
  const save = useCallback2(
    async (key, value) => {
      const row = await api.updateSystemSetting(key, value);
      setSettings((prev) => prev.map((s) => s.key === key ? row : s));
      return row;
    },
    [api]
  );
  return /* @__PURE__ */ jsx6(
    SystemSettingsPanel,
    {
      settings,
      categories: [...manifest.settings.categories, ...KIT_SETTINGS_CATEGORIES].map((c) => ({
        ...c,
        label: t(c.label),
        description: c.description ? t(c.description) : c.description
      })),
      canEdit: isAdmin,
      onSave: save,
      loading,
      loadError
    }
  );
}
function AgentsTab() {
  const t = useKitT();
  const { api, manifest } = useFrame();
  const roles = (manifest.ai ? [...manifest.ai.roles] : []).map((r) => ({ ...r, label: t(r.label) }));
  const [models, setModels] = useState5([]);
  const [drafts, setDrafts] = useState5(null);
  const [loadError, setLoadError] = useState5("");
  const [saveErrors, setSaveErrors] = useState5({});
  useEffect4(() => {
    Promise.all([api.listAgentSettings(), api.listAgentModels()]).then(([rows, options]) => {
      const initial = {};
      for (const r of manifest.ai ? manifest.ai.roles : []) initial[r.id] = { model: "", effort: "" };
      for (const row of rows) initial[row.role] = { model: row.model ?? "", effort: row.effort ?? "" };
      setModels(options);
      setDrafts(initial);
    }).catch((e) => setLoadError(errorText(e, t("kit.settings.agentsLoadFailed"))));
  }, [api, manifest, t]);
  const save = useCallback2(
    async (role, draft) => {
      setSaveErrors((prev) => ({ ...prev, [role]: "" }));
      try {
        await api.saveAgentSetting(role, { model: draft.model, effort: draft.effort });
      } catch (e) {
        setSaveErrors((prev) => ({ ...prev, [role]: errorText(e, t("kit.settings.saveFailed")) }));
        throw e;
      }
    },
    [api, t]
  );
  return /* @__PURE__ */ jsx6(
    AgentsPanel,
    {
      roles,
      models,
      efforts: EFFORTS,
      drafts: drafts ?? {},
      onSave: save,
      loading: drafts === null && !loadError,
      loadError,
      saveErrors
    }
  );
}
function ReadOnlyField({ label, value }) {
  return /* @__PURE__ */ jsxs4("div", { children: [
    /* @__PURE__ */ jsx6("div", { className: "mb-1 text-xs text-[var(--color-text-muted)]", children: label }),
    /* @__PURE__ */ jsx6("div", { className: "text-sm text-[var(--color-text-secondary)]", children: value || "\u2014" })
  ] });
}
function AccountTab() {
  const t = useKitT();
  const { language } = useLanguage2();
  const { api, manifest, user, setUser } = useFrame();
  if (!user) return null;
  if (manifest.auth === "manager") {
    return /* @__PURE__ */ jsx6("div", { className: "p-6", children: /* @__PURE__ */ jsxs4(Card2, { className: "max-w-3xl", children: [
      /* @__PURE__ */ jsx6("p", { className: "mb-4 text-sm text-[var(--color-text-secondary)]", children: t("kit.settings.managedByManager") }),
      /* @__PURE__ */ jsxs4("div", { className: "grid grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsx6(ReadOnlyField, { label: t("kit.settings.fullName"), value: personName(user) }),
        /* @__PURE__ */ jsx6(ReadOnlyField, { label: t("kit.settings.email"), value: user.email }),
        /* @__PURE__ */ jsx6(ReadOnlyField, { label: t("user.username"), value: user.username }),
        /* @__PURE__ */ jsx6(ReadOnlyField, { label: t("user.role"), value: roleLabel(user.role, t) })
      ] })
    ] }) });
  }
  return /* @__PURE__ */ jsx6(
    MyAccountPanel,
    {
      user: {
        username: user.username,
        role: user.role,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      },
      roleLabel: roleLabel(user.role, t),
      telegram: false,
      languages: manifest.languages,
      language,
      onLanguageChange: async (next) => {
        setUser(await api.setLanguage(next));
      },
      passwordMinLength: PASSWORD_MIN_LENGTH,
      onSaveProfile: async ({ email, first_name, last_name }) => {
        setUser(await api.updateMe({ email, first_name, last_name }));
      },
      askCurrentPassword: false,
      onChangePassword: (_current, next) => api.changePassword("", next)
    }
  );
}
function UsersTab() {
  const t = useKitT();
  const { api, isAdmin, manifest, user } = useFrame();
  const installation = useInstallationIdentity();
  const defaultLanguage = chooseLanguage(manifest.languages, null, installation?.language);
  const roleOptions = STANDARD_ROLES.map((r) => ({ value: r.value, label: t(r.label) }));
  const [users, setUsers] = useState5([]);
  useEffect4(() => {
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }, [api]);
  const replace = (row) => setUsers((prev) => prev.map((u) => u.id === row.id ? row : u));
  return /* @__PURE__ */ jsx6(
    UsersPanel,
    {
      users,
      rowActions: manifest.userActions,
      roleOptions,
      canManage: isAdmin,
      currentUserId: user?.id,
      mayDelete: (u) => u.role !== ADMIN_ROLE,
      fieldSchema: USER_FIELDS,
      languages: manifest.languages,
      defaultLanguage,
      onCreate: async (d) => {
        const row = await api.createUser({
          username: d.username,
          email: d.email,
          password: d.password,
          role: d.role,
          first_name: d.first_name,
          last_name: d.last_name,
          is_active: d.is_active,
          ...d.language ? { language: d.language } : {}
        });
        setUsers((prev) => [...prev, row]);
      },
      onUpdate: async (id, d) => {
        replace(
          await api.updateUser(id, {
            email: d.email,
            role: d.role,
            first_name: d.first_name,
            last_name: d.last_name,
            is_active: d.is_active,
            ...d.language ? { language: d.language } : {}
          })
        );
      },
      onDelete: async (id) => {
        await api.deleteUser(id);
        setUsers((prev) => prev.filter((u) => u.id !== id));
      },
      onChangePassword: (id, password) => api.setUserPassword(id, password),
      onToggleActive: async (u) => {
        replace(
          await api.updateUser(u.id, {
            email: u.email,
            role: u.role,
            first_name: u.first_name ?? "",
            last_name: u.last_name ?? "",
            is_active: !u.is_active
          })
        );
      },
      roleClass: (role) => role === ADMIN_ROLE ? "text-[var(--color-accent-primary)]" : ""
    }
  );
}
function SessionsTab() {
  const t = useKitT();
  const { api, isAdmin } = useFrame();
  const [sessions, setSessions] = useState5([]);
  const [loading, setLoading] = useState5(true);
  const [loadError, setLoadError] = useState5("");
  useEffect4(() => {
    api.listSessions().then(setSessions).catch((e) => setLoadError(errorText(e, t("kit.settings.sessionsLoadFailed")))).finally(() => setLoading(false));
  }, [api, t]);
  const names = useMemo3(() => Object.fromEntries(sessions.map((s) => [s.user_id, s.username ?? s.user_id])), [sessions]);
  return /* @__PURE__ */ jsx6(
    SessionsPanel,
    {
      sessions,
      resolveUsername: (id) => names[id] ?? id,
      canRevoke: isAdmin,
      onRevoke: async (id) => {
        await api.revokeSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      },
      loading,
      loadError,
      description: t("kit.settings.sessionsHint")
    }
  );
}
function SettingsPage() {
  const t = useKitT();
  const { manifest, user } = useFrame();
  const config = useMemo3(() => settingsConfig(manifest), [manifest]);
  const headerRight = user ? /* @__PURE__ */ jsxs4("span", { className: "text-xs text-[var(--color-text-muted)]", children: [
    t("kit.settings.signedInAs"),
    " ",
    /* @__PURE__ */ jsx6("span", { className: "font-medium text-[var(--color-text-secondary)]", children: user.username }),
    " \xB7 ",
    /* @__PURE__ */ jsx6("span", { className: "text-[11px] font-medium", children: roleLabel(user.role, t) })
  ] }) : void 0;
  return /* @__PURE__ */ jsx6(
    SettingsShell,
    {
      config,
      currentUserRole: user?.role ?? "",
      title: t("settings.title"),
      headerRight,
      panels: {
        system: /* @__PURE__ */ jsx6(SystemTab, {}),
        agents: /* @__PURE__ */ jsx6(AgentsTab, {}),
        konto: /* @__PURE__ */ jsx6(AccountTab, {}),
        users: /* @__PURE__ */ jsx6(UsersTab, {}),
        sessions: /* @__PURE__ */ jsx6(SessionsTab, {})
      }
    }
  );
}

// src/templates/nsv-standard/pages/UpdatesPage.tsx
import { useCallback as useCallback3, useEffect as useEffect5, useState as useState6 } from "react";
import { ReleaseNotes } from "nex-shared";
import { jsx as jsx7 } from "react/jsx-runtime";
function UpdatesPage() {
  const t = useKitT();
  const { api, manifest } = useFrame();
  const [notes, setNotes] = useState6([]);
  const [loading, setLoading] = useState6(true);
  const [error, setError] = useState6("");
  const refresh = useCallback3(async () => {
    setLoading(true);
    setError("");
    try {
      setNotes(await api.releaseNotes());
    } catch (e) {
      setError(errorText(e, t("kit.updates.failed")));
    } finally {
      setLoading(false);
    }
  }, [api, t]);
  useEffect5(() => {
    void refresh();
  }, [refresh]);
  return /* @__PURE__ */ jsx7(
    ReleaseNotes,
    {
      notes,
      loading,
      error: error || null,
      onDismissError: () => setError(""),
      appName: manifest.name
    }
  );
}

// src/templates/nsv-standard/places.ts
var TEMPLATE_PLACES = {
  overview: { path: "/", label: "kit.place.overview", icon: "\u{1F3E0}" },
  gettingStarted: { path: "/getting-started", label: "kit.place.gettingStarted", icon: "\u{1F9ED}" },
  updates: { path: "/updates", label: "kit.place.updates", icon: "\u2728" },
  settings: { path: "/settings", label: "kit.place.settings", icon: "\u2699\uFE0F" }
};

// src/templates/nsv-standard/Shell.tsx
import { useEffect as useEffect7 } from "react";
import { Outlet } from "react-router-dom";
import { useStore as useStore2 } from "zustand";
import { AppShell } from "nex-shared";

// src/templates/nsv-standard/PageErrorBoundary.tsx
import { Component } from "react";
import { useLocation } from "react-router-dom";
import { jsx as jsx8, jsxs as jsxs5 } from "react/jsx-runtime";
function Crashed({ message }) {
  const t = useKitT();
  return /* @__PURE__ */ jsxs5("div", { role: "alert", className: "m-4 rounded-xl border border-[var(--color-state-error-fg)]/40 bg-[var(--color-state-error-bg)] p-4", children: [
    /* @__PURE__ */ jsx8("h2", { className: "text-sm font-semibold text-[var(--color-state-error-fg)]", children: t("kit.error.title") }),
    /* @__PURE__ */ jsx8("p", { className: "mt-2 text-sm text-[var(--color-text-primary)]", children: t("kit.error.text") }),
    /* @__PURE__ */ jsx8("p", { className: "mt-1 font-mono text-[11px] text-[var(--color-text-muted)]", children: message }),
    /* @__PURE__ */ jsx8(
      "button",
      {
        type: "button",
        onClick: () => window.location.reload(),
        className: "mt-3 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
        children: t("kit.error.reload")
      }
    )
  ] });
}
var Boundary = class extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return /* @__PURE__ */ jsx8(Crashed, { message: error.message });
  }
};
function PageErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return /* @__PURE__ */ jsx8(Boundary, { children }, pathname);
}

// src/templates/nsv-standard/Sidebar.tsx
import { useLocation as useLocation2, useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { Brand as Brand2, NavIcon, NavItem, SectionDivider, Sidebar, UserCard, useShell } from "nex-shared";

// src/frame/version.ts
import { useEffect as useEffect6, useState as useState7 } from "react";
function versionLine(backend, frontend) {
  const be = (backend ?? "").trim();
  const fe = (frontend ?? "").trim();
  if (!be) return fe ? `v${fe}` : void 0;
  if (!fe || fe === be) return `v${be}`;
  return `backend v${be} \xB7 frontend v${fe}`;
}
function useBackendVersion(api) {
  const [version, setVersion] = useState7();
  useEffect6(() => {
    let live = true;
    api.health().then((h) => live && setVersion(h.version)).catch(() => void 0);
    return () => {
      live = false;
    };
  }, [api]);
  return version;
}

// src/templates/nsv-standard/Sidebar.tsx
import { Fragment, jsx as jsx9, jsxs as jsxs6 } from "react/jsx-runtime";
function useIsActive() {
  const { pathname } = useLocation2();
  return (path) => path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
function CountedEntry({ entry, active, onClick }) {
  const t = useKitT();
  const count = entry.useCount?.() ?? void 0;
  return /* @__PURE__ */ jsx9(NavItem, { icon: /* @__PURE__ */ jsx9(NavIcon, { glyph: entry.icon }), label: t(entry.label), active, onClick, count: count ?? void 0 });
}
function VisibleEntry({ entry, children }) {
  return entry.useVisible() === true ? /* @__PURE__ */ jsx9(Fragment, { children }) : null;
}
function NsvSidebar() {
  const t = useKitT();
  const { manifest, api, user, isAdmin, onLogout, frontendVersion, layout: store } = useFrame();
  const layout = useStore(store, (s) => s.layout);
  const saveLayout = useStore(store, (s) => s.save);
  const navigate = useNavigate();
  const isActive = useIsActive();
  const backendVersion = useBackendVersion(api);
  const { narrow } = useShell();
  const railCollapsed = layout?.sidebar_collapsed ?? false;
  const limit = layout?.limits.sidebar_width;
  const name = personName(user) || user?.email || "";
  const footer = /* @__PURE__ */ jsx9(
    UserCard,
    {
      initials: name ? name.slice(0, 1).toUpperCase() : "?",
      name: name || "\u2014",
      subtitle: roleLabel(user?.role, t),
      onLogout
    }
  );
  const entry = (place) => /* @__PURE__ */ jsx9(
    NavItem,
    {
      icon: /* @__PURE__ */ jsx9(NavIcon, { glyph: place.icon }),
      label: t(place.label),
      active: isActive(place.path),
      onClick: () => navigate(place.path)
    },
    place.path
  );
  const modules = manifest.modules.flatMap((id) => MODULES[id] ? [MODULES[id]] : []);
  const ownEntries = manifest.nav.filter((e) => !e.adminOnly || isAdmin);
  return /* @__PURE__ */ jsxs6(
    Sidebar,
    {
      collapsed: railCollapsed && !narrow,
      onToggleCollapse: () => void saveLayout({ sidebar_collapsed: !railCollapsed }),
      logo: /* @__PURE__ */ jsx9(Brand2, { initials: manifest.initials, name: manifest.name, version: versionLine(backendVersion, frontendVersion) }),
      footer,
      dense: true,
      width: layout?.sidebar_width ?? void 0,
      onWidthChange: limit ? (w) => void saveLayout({ sidebar_width: w === limit.default ? null : w }) : void 0,
      minWidth: limit?.min,
      maxWidth: limit?.max,
      defaultWidth: limit?.default,
      children: [
        (!railCollapsed || narrow) && /* @__PURE__ */ jsx9(InstallationCustomer, { className: "px-3 pb-1.5 pt-0.5" }),
        manifest.overviewVisible ? (
          // DEV-368: Prehľad only for those the app says see it — like its own entries.
          /* @__PURE__ */ jsx9(VisibleEntry, { entry: { ...TEMPLATE_PLACES.overview, useVisible: manifest.overviewVisible }, children: entry(TEMPLATE_PLACES.overview) }, TEMPLATE_PLACES.overview.path)
        ) : entry(TEMPLATE_PLACES.overview),
        entry(TEMPLATE_PLACES.gettingStarted),
        modules.map((m) => entry(m)),
        ownEntries.map((e) => {
          const shown = e.useCount ? /* @__PURE__ */ jsx9(CountedEntry, { entry: e, active: isActive(e.path), onClick: () => navigate(e.path) }, e.path) : entry(e);
          const { useVisible } = e;
          return useVisible ? /* @__PURE__ */ jsx9(VisibleEntry, { entry: { ...e, useVisible }, children: shown }, e.path) : shown;
        }),
        entry(TEMPLATE_PLACES.updates),
        /* @__PURE__ */ jsx9(SectionDivider, {}),
        entry(TEMPLATE_PLACES.settings)
      ]
    }
  );
}

// src/templates/nsv-standard/Topbar.tsx
import { useLocation as useLocation3 } from "react-router-dom";
import { Header, ThemeToggle } from "nex-shared";
import { jsx as jsx10, jsxs as jsxs7 } from "react/jsx-runtime";
function placeLabel(pathname, manifest) {
  const places = [
    ...Object.values(TEMPLATE_PLACES),
    ...manifest.modules.flatMap((id) => MODULES[id] ? [MODULES[id]] : []),
    ...manifest.nav
  ];
  const exact = places.find((p) => p.path === pathname);
  if (exact) return exact.label;
  const under = places.filter((p) => p.path !== "/" && pathname.startsWith(`${p.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];
  return under?.label ?? manifest.name;
}
function NsvTopbar() {
  const t = useKitT();
  const { manifest } = useFrame();
  const { pathname } = useLocation3();
  const { isDark, toggleDark } = useTheme();
  return /* @__PURE__ */ jsx10(
    Header,
    {
      left: /* @__PURE__ */ jsxs7("div", { className: "flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden text-xs text-[var(--color-text-muted)]", children: [
        /* @__PURE__ */ jsx10("span", { className: "text-[var(--color-text-muted)]", children: "/" }),
        /* @__PURE__ */ jsx10("span", { className: "text-[var(--color-text-secondary)] truncate", children: t(placeLabel(pathname, manifest)) })
      ] }),
      right: /* @__PURE__ */ jsx10(ThemeToggle, { theme: isDark ? "dark" : "light", onToggle: toggleDark })
    }
  );
}

// src/templates/nsv-standard/Shell.tsx
import { jsx as jsx11 } from "react/jsx-runtime";
function NsvShell() {
  const { user, layout } = useFrame();
  const load = useStore2(layout, (s) => s.load);
  const reset = useStore2(layout, (s) => s.reset);
  const userId = user?.id;
  useEffect7(() => {
    reset();
    if (userId) void load();
  }, [userId, load, reset]);
  return /* @__PURE__ */ jsx11(AppShell, { sidebar: /* @__PURE__ */ jsx11(NsvSidebar, {}), header: /* @__PURE__ */ jsx11(NsvTopbar, {}), topBanner: /* @__PURE__ */ jsx11(InstallationBand, {}), children: /* @__PURE__ */ jsx11(PageErrorBoundary, { children: /* @__PURE__ */ jsx11(Outlet, {}) }) });
}

// src/templates/nsv-standard/NsvStandard.tsx
import { Fragment as Fragment2, jsx as jsx12, jsxs as jsxs8 } from "react/jsx-runtime";
function Padded({ children }) {
  return /* @__PURE__ */ jsx12("div", { className: "p-6", children: children ?? /* @__PURE__ */ jsx12(Outlet2, {}) });
}
var everyone = () => true;
function firstPlaceWithoutOverview(manifest, isAdmin) {
  const own = manifest.nav.find((e) => !e.useVisible && (!e.adminOnly || isAdmin));
  return own?.path ?? TEMPLATE_PLACES.gettingStarted.path;
}
function OverviewPlace({ overview }) {
  const { manifest, isAdmin } = useFrame();
  const useOverviewVisible = manifest.overviewVisible ?? everyone;
  const answer = useOverviewVisible();
  if (answer === true) return /* @__PURE__ */ jsx12(Fragment2, { children: overview });
  if (answer === false) return /* @__PURE__ */ jsx12(Navigate, { to: firstPlaceWithoutOverview(manifest, isAdmin), replace: true });
  return null;
}
function NsvStandard({ overview, children }) {
  const { manifest } = useFrame();
  const modules = manifest.modules.flatMap((id) => MODULES[id] ? [MODULES[id]] : []);
  return /* @__PURE__ */ jsx12(Routes, { children: /* @__PURE__ */ jsxs8(Route, { element: /* @__PURE__ */ jsx12(NsvShell, {}), children: [
    /* @__PURE__ */ jsx12(Route, { path: TEMPLATE_PLACES.updates.path, element: /* @__PURE__ */ jsx12(UpdatesPage, {}) }),
    /* @__PURE__ */ jsx12(Route, { path: TEMPLATE_PLACES.settings.path, element: /* @__PURE__ */ jsx12(SettingsPage, {}) }),
    /* @__PURE__ */ jsxs8(Route, { element: /* @__PURE__ */ jsx12(Padded, {}), children: [
      /* @__PURE__ */ jsx12(Route, { index: true, element: /* @__PURE__ */ jsx12(OverviewPlace, { overview }) }),
      /* @__PURE__ */ jsx12(Route, { path: TEMPLATE_PLACES.gettingStarted.path, element: /* @__PURE__ */ jsx12(GettingStartedPage, {}) }),
      modules.map((m) => /* @__PURE__ */ jsx12(Route, { path: `${m.path}/*`, element: m.page() }, m.id)),
      children,
      /* @__PURE__ */ jsx12(Route, { path: "*", element: /* @__PURE__ */ jsx12(NotFoundPage, {}) })
    ] })
  ] }) });
}

// src/templates/registry.ts
var TEMPLATES = Object.freeze({
  "nsv-standard": NsvStandard
});

// src/TemplateApp.tsx
import { jsx as jsx13 } from "react/jsx-runtime";
var SIGNED_OUT_SENTENCES = {
  managerExpired: "kit.signedOut.managerExpired",
  managerLogout: "kit.signedOut.managerLogout",
  passwordExpired: "kit.signedOut.passwordExpired"
};
function SignedOut({ manifest, api, why, onSignedIn }) {
  const t = useKitT();
  return manifest.auth === "manager" ? /* @__PURE__ */ jsx13(
    ClosedScreen,
    {
      manifest,
      sentence: t(why === "logout" ? SIGNED_OUT_SENTENCES.managerLogout : SIGNED_OUT_SENTENCES.managerExpired)
    }
  ) : /* @__PURE__ */ jsx13(
    LoginScreen,
    {
      manifest,
      api,
      note: why === "expired" ? t(SIGNED_OUT_SENTENCES.passwordExpired) : void 0,
      onSignedIn
    }
  );
}
function sameOriginClient() {
  return createApiClient({ baseUrl: "", apiPrefix: "/api/v1", getToken: () => null });
}
function TemplateApp({ manifest, client, frontendVersion, overview, children }) {
  const api = useMemo4(() => createStandardApi(client ?? sameOriginClient()), [client]);
  const installation = useInstallation(api);
  useInstallationWindow(manifest.name, installation);
  const [layout] = useState8(() => createLayoutStore(api));
  const [session, setSession] = useState8({ kind: "loading" });
  const ask = useCallback4(() => {
    let live = true;
    setSession({ kind: "loading" });
    api.me().then((user2) => live && setSession({ kind: "in", user: user2 })).catch((e) => {
      if (!live) return;
      setSession(e instanceof ApiError && e.status === 401 ? { kind: "out", why: "start" } : { kind: "unavailable" });
    });
    return () => {
      live = false;
    };
  }, [api]);
  useEffect8(ask, [ask]);
  useEffect8(() => {
    registerAuthCallback(() => setSession((s) => s.kind === "in" ? { kind: "out", why: "expired" } : s));
  }, []);
  const signedInId = session.kind === "in" ? session.user.id : null;
  useEffect8(() => {
    if (!signedInId) return;
    return onServerChange(({ path }) => {
      if (path !== "/auth/me" && path !== `/users/${signedInId}` && !path.startsWith(`/users/${signedInId}/`)) return;
      api.me().then((fresh) => setSession((s) => s.kind === "in" && s.user.id === fresh.id ? { kind: "in", user: fresh } : s)).catch(() => void 0);
    });
  }, [api, signedInId]);
  const logout = useCallback4(async () => {
    try {
      await api.logout();
    } finally {
      setSession({ kind: "out", why: "logout" });
    }
  }, [api]);
  const user = session.kind === "in" ? session.user : null;
  const setUser = useCallback4((next) => setSession({ kind: "in", user: next }), []);
  const frame = useMemo4(
    () => user && {
      manifest,
      api,
      user,
      setUser,
      isAdmin: user.role === ADMIN_ROLE,
      onLogout: () => void logout(),
      frontendVersion,
      layout
    },
    [manifest, api, user, setUser, logout, frontendVersion, layout]
  );
  const Template = TEMPLATES[manifest.template];
  let screen;
  if (session.kind === "loading") {
    screen = /* @__PURE__ */ jsx13(LoadingScreen, {});
  } else if (session.kind === "unavailable") {
    screen = /* @__PURE__ */ jsx13(UnavailableScreen, { manifest, onRetry: ask });
  } else if (session.kind === "out") {
    screen = /* @__PURE__ */ jsx13(SignedOut, { manifest, api, why: session.why, onSignedIn: setUser });
  } else if (session.user.must_change_password && manifest.auth === "password") {
    screen = /* @__PURE__ */ jsx13(
      ChangePasswordScreen,
      {
        manifest,
        api,
        onChanged: () => setUser({ ...session.user, must_change_password: false }),
        onLogout: () => void logout()
      }
    );
  } else {
    screen = /* @__PURE__ */ jsx13(FrameContext.Provider, { value: frame, children: /* @__PURE__ */ jsx13(Template, { overview, children }) });
  }
  const language = chooseLanguage(manifest.languages, user?.language, installation?.language);
  const messages = useMemo4(() => mergeMessages(manifest.messages), [manifest.messages]);
  useEffect8(() => {
    document.documentElement.lang = language;
  }, [language]);
  return /* @__PURE__ */ jsx13(I18nProvider, { language, messages, children: /* @__PURE__ */ jsx13(ThemeProvider, { username: user?.username, children: /* @__PURE__ */ jsx13(InstallationContext.Provider, { value: installation, children: screen }) }) });
}

// src/screens/KitPage.tsx
import { useEffect as useEffect9, useMemo as useMemo5 } from "react";
import { useLocation as useLocation4, useNavigate as useNavigate2 } from "react-router-dom";
import { Page as Page3 } from "nex-shared";

// src/screens/navHistory.ts
import { create } from "zustand";
var useNavHistory = create((set) => ({
  stack: [],
  visit: (screen, startsWalk) => set(({ stack }) => {
    if (startsWalk) return { stack: [screen] };
    const at = stack.findIndex((s) => s.pathname === screen.pathname);
    if (at >= 0) return { stack: [...stack.slice(0, at), screen] };
    return { stack: [...stack, screen] };
  })
}));

// src/screens/KitPage.tsx
import { Fragment as Fragment3, jsx as jsx14, jsxs as jsxs9 } from "react/jsx-runtime";
function KitBackLink({ label }) {
  const t = useKitT();
  const { manifest } = useFrame();
  const location = useLocation4();
  const navigate = useNavigate2();
  const { stack, visit } = useNavHistory();
  const path = `${location.pathname}${location.search}`;
  const starts = useMemo5(
    () => /* @__PURE__ */ new Set([...TEMPLATE_PATHS, ...manifest.nav.map((entry) => entry.path)]),
    [manifest.nav]
  );
  useEffect9(() => {
    visit({ pathname: location.pathname, path, label }, starts.has(location.pathname));
  }, [location.pathname, path, label, starts, visit]);
  const at = stack.findIndex((s) => s.pathname === location.pathname);
  const previous = at > 0 ? stack[at - 1] : null;
  if (!previous) return null;
  return /* @__PURE__ */ jsxs9(
    "button",
    {
      type: "button",
      onClick: () => navigate(previous.path),
      className: "mb-2 flex items-center gap-1 text-sm text-[var(--color-accent,#2563eb)] hover:underline",
      "aria-label": t("kit.back.to", { screen: previous.label }),
      children: [
        /* @__PURE__ */ jsx14("span", { "aria-hidden": "true", children: "\u2190" }),
        /* @__PURE__ */ jsx14("span", { children: previous.label })
      ]
    }
  );
}
function KitPage({ title, crumb, subtitle, actions, width, children }) {
  return /* @__PURE__ */ jsxs9(Fragment3, { children: [
    /* @__PURE__ */ jsx14(KitBackLink, { label: crumb ?? (typeof title === "string" ? title : "") }),
    /* @__PURE__ */ jsx14(Page3, { title, subtitle, actions, width, children })
  ] });
}

// src/screens/KitTable.tsx
import { DataTable } from "nex-shared";
import { jsx as jsx15, jsxs as jsxs10 } from "react/jsx-runtime";
var TIGHT_ROWS = "[&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-0.5 [&_td]:leading-tight [&_td_button]:py-0.5 [&_td_input]:py-0.5 [&_td_select]:py-0.5";
function KitTable({ className = "", ...props }) {
  return /* @__PURE__ */ jsx15(DataTable, { ...props, className: `${TIGHT_ROWS} ${className}`.trim() });
}
function KitFields({ rows }) {
  return /* @__PURE__ */ jsx15("dl", { className: "grid grid-cols-1 gap-x-8 text-sm leading-tight sm:grid-cols-2 xl:grid-cols-3", children: rows.map((row, i) => /* @__PURE__ */ jsxs10("div", { className: "flex justify-between gap-4 border-b border-[var(--color-border,#e5e7eb)] py-0.5", children: [
    /* @__PURE__ */ jsx15("dt", { className: "text-[var(--color-text-secondary)]", children: row.label }),
    /* @__PURE__ */ jsx15("dd", { className: "text-right", children: row.value })
  ] }, i)) });
}
export {
  ADMIN_ROLE,
  KIT_MESSAGES,
  KitBackLink,
  KitFields,
  KitPage,
  KitTable,
  MODULES,
  ManifestError,
  NAV_LABEL_MAX,
  PASSWORD_MIN_LENGTH,
  STANDARD_ENDPOINTS,
  STANDARD_ROLES,
  TEMPLATES,
  TEMPLATE_IDS,
  TEMPLATE_PATHS,
  TIGHT_ROWS,
  TemplateApp,
  chooseLanguage,
  createStandardApi,
  defineApp,
  mergeMessages,
  personName,
  roleLabel,
  useFrame,
  useKitT
};
