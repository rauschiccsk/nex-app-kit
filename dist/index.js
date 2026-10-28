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
function defineApp(input) {
  const problems = [];
  const ai = input.ai ?? false;
  const modules = input.modules ?? [];
  const nav = input.nav ?? [];
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
  for (const entry of nav) {
    if ([...entry.label].length > NAV_LABEL_MAX) {
      problems.push(
        `Polo\u017Eka \u201E${entry.label}\u201C m\xE1 ${[...entry.label].length} znakov \u2014 v \u013Eavom paneli sa zmest\xED najviac ${NAV_LABEL_MAX}.`
      );
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
  if (problems.length) throw new ManifestError(problems);
  return Object.freeze({
    template: input.template,
    name: input.name,
    initials: input.initials,
    auth: input.auth,
    ai: ai ? Object.freeze({ roles: Object.freeze([...ai.roles]) }) : false,
    modules: Object.freeze([...modules]),
    nav: Object.freeze([...nav]),
    settings: Object.freeze({ categories: Object.freeze([...input.settings?.categories ?? []]) })
  });
}
function duplicates(values) {
  const seen = /* @__PURE__ */ new Set();
  const twice = /* @__PURE__ */ new Set();
  for (const v of values) (seen.has(v) ? twice : seen).add(v);
  return [...twice];
}

// src/standard-api.ts
var STANDARD_ROLES = [
  { value: "admin", label: "Spr\xE1vca" },
  { value: "user", label: "Pou\u017E\xEDvate\u013E" }
];
var ADMIN_ROLE = "admin";
var PASSWORD_MIN_LENGTH = 8;
var STANDARD_ENDPOINTS = [
  { id: "health", method: "GET", path: "/health", scope: "always" },
  { id: "me", method: "GET", path: "/auth/me", scope: "always" },
  { id: "updateMe", method: "PATCH", path: "/auth/me", scope: "password" },
  { id: "changePassword", method: "POST", path: "/auth/change-password", scope: "password" },
  { id: "listUsers", method: "GET", path: "/users", scope: "password" },
  { id: "createUser", method: "POST", path: "/users", scope: "password" },
  { id: "updateUser", method: "PATCH", path: "/users/{id}", scope: "password" },
  { id: "deleteUser", method: "DELETE", path: "/users/{id}", scope: "password" },
  { id: "setUserPassword", method: "POST", path: "/users/{id}/password", scope: "password" },
  { id: "listSessions", method: "GET", path: "/sessions", scope: "always" },
  { id: "revokeSession", method: "DELETE", path: "/sessions/{id}", scope: "always" },
  { id: "listSystemSettings", method: "GET", path: "/system-settings", scope: "always" },
  { id: "updateSystemSetting", method: "PATCH", path: "/system-settings/{key}", scope: "always" },
  { id: "listAgentSettings", method: "GET", path: "/agent-settings", scope: "ai" },
  { id: "listAgentModels", method: "GET", path: "/agent-settings/models", scope: "ai" },
  { id: "saveAgentSetting", method: "PUT", path: "/agent-settings/{role}", scope: "ai" },
  { id: "getLayout", method: "GET", path: "/user-layout", scope: "always" },
  { id: "saveLayout", method: "PUT", path: "/user-layout", scope: "always" },
  { id: "releaseNotes", method: "GET", path: "/release-notes", scope: "always" },
  { id: "gettingStarted", method: "GET", path: "/getting-started", scope: "always" }
];
function createStandardApi(client) {
  function call(id, params = {}, body) {
    const endpoint = STANDARD_ENDPOINTS.find((e) => e.id === id);
    if (!endpoint) throw new Error(`Unknown standard endpoint: ${id}`);
    const path = endpoint.path.replace(/\{(\w+)\}/g, (_, name) => {
      const value = params[name];
      if (value === void 0) throw new Error(`Endpoint ${id} needs the path parameter ${name}`);
      return encodeURIComponent(value);
    });
    switch (endpoint.method) {
      case "GET":
        return client.get(path);
      case "DELETE":
        return client.delete(path);
      case "POST":
        return client.post(path, body);
      case "PUT":
        return client.put(path, body);
      case "PATCH":
        return client.patch(path, body);
    }
  }
  return {
    health: () => call("health"),
    me: () => call("me"),
    updateMe: (changes) => call("updateMe", {}, changes),
    changePassword: (currentPassword, newPassword) => call("changePassword", {}, { current_password: currentPassword, new_password: newPassword }),
    listUsers: () => call("listUsers"),
    createUser: (user) => call("createUser", {}, user),
    updateUser: (id, changes) => call("updateUser", { id }, changes),
    deleteUser: (id) => call("deleteUser", { id }),
    setUserPassword: (id, newPassword) => call("setUserPassword", { id }, { new_password: newPassword }),
    listSessions: () => call("listSessions"),
    revokeSession: (id) => call("revokeSession", { id }),
    listSystemSettings: () => call("listSystemSettings"),
    updateSystemSetting: (key, value) => call("updateSystemSetting", { key }, { value }),
    listAgentSettings: () => call("listAgentSettings"),
    listAgentModels: () => call("listAgentModels"),
    saveAgentSetting: (role, setting) => call("saveAgentSetting", { role }, setting),
    getLayout: () => call("getLayout"),
    saveLayout: (changes) => call("saveLayout", {}, changes),
    releaseNotes: () => call("releaseNotes"),
    gettingStarted: () => call("gettingStarted")
  };
}

// src/TemplateApp.tsx
import { useEffect as useEffect7, useMemo as useMemo3, useState as useState6 } from "react";

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

// src/frame/theme.tsx
import { createContext as createContext2, useCallback, useContext as useContext2, useEffect, useMemo, useState } from "react";
import { jsx } from "react/jsx-runtime";
var ThemeContext = createContext2(null);
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
  const [isDark, setIsDark] = useState(() => readDark(username));
  useEffect(() => setIsDark(readDark(username)), [username]);
  useEffect(() => {
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
  const value = useMemo(() => ({ isDark, toggleDark }), [isDark, toggleDark]);
  return /* @__PURE__ */ jsx(ThemeContext.Provider, { value, children });
}
function useTheme() {
  const value = useContext2(ThemeContext);
  if (!value) throw new Error("useTheme must be used inside <TemplateApp>");
  return value;
}

// src/templates/nsv-standard/NsvStandard.tsx
import { Outlet as Outlet2, Route, Routes } from "react-router-dom";

// src/templates/nsv-standard/pages/GettingStartedPage.tsx
import { useEffect as useEffect2, useState as useState2 } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Page } from "nex-shared";

// src/frame/people.ts
function personName(person) {
  if (!person) return "";
  const full = [person.first_name, person.last_name].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
  return full || person.username;
}
function roleLabel(role) {
  if (!role) return "\u2014";
  return STANDARD_ROLES.find((r) => r.value === role)?.label ?? role;
}
function errorText(error, fallback) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// src/templates/nsv-standard/pages/GettingStartedPage.tsx
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
var PROSE = `prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold
  prose-p:text-[var(--color-text-secondary)] prose-p:leading-relaxed prose-strong:text-[var(--color-text-primary)]
  prose-li:text-[var(--color-text-secondary)] prose-li:marker:text-primary-500`;
function GettingStartedPage() {
  const { api } = useFrame();
  const [markdown, setMarkdown] = useState2(null);
  const [error, setError] = useState2("");
  useEffect2(() => {
    let live = true;
    api.gettingStarted().then((g) => live && setMarkdown(g.markdown ?? "")).catch((e) => live && setError(errorText(e, "server neodpoved\xE1")));
    return () => {
      live = false;
    };
  }, [api]);
  return /* @__PURE__ */ jsx2(Page, { title: "Ako za\u010Da\u0165", width: "narrow", children: error ? /* @__PURE__ */ jsxs("p", { className: "text-sm text-[var(--color-status-error)]", children: [
    "N\xE1vod sa nepodarilo na\u010D\xEDta\u0165: ",
    error
  ] }) : markdown === null ? /* @__PURE__ */ jsx2("p", { className: "text-sm text-[var(--color-text-muted)]", children: "Na\u010D\xEDtavam\u2026" }) : markdown.trim() === "" ? /* @__PURE__ */ jsx2("p", { className: "text-sm text-[var(--color-text-muted)]", children: "N\xE1vod k aplik\xE1cii e\u0161te nie je nap\xEDsan\xFD." }) : /* @__PURE__ */ jsx2("div", { className: PROSE, children: /* @__PURE__ */ jsx2(ReactMarkdown, { remarkPlugins: [remarkGfm], children: markdown }) }) });
}

// src/templates/nsv-standard/pages/NotFoundPage.tsx
import { Link } from "react-router-dom";
import { Page as Page2 } from "nex-shared";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
function NotFoundPage() {
  return /* @__PURE__ */ jsxs2(Page2, { title: "Str\xE1nka neexistuje", width: "narrow", children: [
    /* @__PURE__ */ jsx3("p", { className: "text-sm text-[var(--color-text-secondary)]", children: "Na tejto adrese ni\u010D nie je. Mo\u017Eno sa zmenila, alebo bola zle nap\xEDsan\xE1." }),
    /* @__PURE__ */ jsx3(Link, { to: "/", className: "mt-3 inline-block text-sm text-[var(--color-accent-primary)] hover:underline", children: "Sp\xE4\u0165 na Preh\u013Ead" })
  ] });
}

// src/templates/nsv-standard/pages/SettingsPage.tsx
import { useCallback as useCallback2, useEffect as useEffect3, useMemo as useMemo2, useState as useState3 } from "react";
import {
  AgentsPanel,
  Card,
  MyAccountPanel,
  SessionsPanel,
  SettingsShell,
  SystemSettingsPanel,
  UsersPanel
} from "nex-shared";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var LABELS = {
  system: "Syst\xE9m",
  agents: "Agenti",
  konto: "Moje konto",
  users: "Pou\u017E\xEDvatelia",
  sessions: "Rel\xE1cie"
};
var EFFORTS = ["low", "medium", "high", "xhigh", "max"];
var ROLE_OPTIONS = STANDARD_ROLES.map((r) => ({ value: r.value, label: r.label }));
var USER_FIELDS = { username: true, names: true, telegram: false, passwordMinLength: PASSWORD_MIN_LENGTH };
function settingsConfig(manifest) {
  const tabs = ["system"];
  if (manifest.ai) tabs.push("agents");
  tabs.push("konto");
  if (manifest.auth === "password") tabs.push("users");
  tabs.push("sessions");
  return {
    tabs,
    labels: LABELS,
    tabVisibleForRole: (tab, role) => tab === "users" || tab === "agents" ? role === ADMIN_ROLE : true
  };
}
function SystemTab() {
  const { api, manifest, isAdmin } = useFrame();
  const [settings, setSettings] = useState3([]);
  const [loading, setLoading] = useState3(true);
  const [loadError, setLoadError] = useState3("");
  useEffect3(() => {
    api.listSystemSettings().then(setSettings).catch((e) => setLoadError(errorText(e, "Nepodarilo sa na\u010D\xEDta\u0165 nastavenia."))).finally(() => setLoading(false));
  }, [api]);
  const save = useCallback2(
    async (key, value) => {
      const row = await api.updateSystemSetting(key, value);
      setSettings((prev) => prev.map((s) => s.key === key ? row : s));
      return row;
    },
    [api]
  );
  return /* @__PURE__ */ jsx4(
    SystemSettingsPanel,
    {
      settings,
      categories: [...manifest.settings.categories],
      canEdit: isAdmin,
      onSave: save,
      loading,
      loadError
    }
  );
}
function AgentsTab() {
  const { api, manifest } = useFrame();
  const roles = manifest.ai ? [...manifest.ai.roles] : [];
  const [models, setModels] = useState3([]);
  const [drafts, setDrafts] = useState3(null);
  const [loadError, setLoadError] = useState3("");
  const [saveErrors, setSaveErrors] = useState3({});
  useEffect3(() => {
    Promise.all([api.listAgentSettings(), api.listAgentModels()]).then(([rows, options]) => {
      const initial = {};
      for (const r of manifest.ai ? manifest.ai.roles : []) initial[r.id] = { model: "", effort: "" };
      for (const row of rows) initial[row.role] = { model: row.model ?? "", effort: row.effort ?? "" };
      setModels(options);
      setDrafts(initial);
    }).catch((e) => setLoadError(errorText(e, "Nepodarilo sa na\u010D\xEDta\u0165 nastavenia agentov.")));
  }, [api, manifest]);
  const save = useCallback2(
    async (role, draft) => {
      setSaveErrors((prev) => ({ ...prev, [role]: "" }));
      try {
        await api.saveAgentSetting(role, { model: draft.model, effort: draft.effort });
      } catch (e) {
        setSaveErrors((prev) => ({ ...prev, [role]: errorText(e, "Ulo\u017Eenie zlyhalo.") }));
        throw e;
      }
    },
    [api]
  );
  return /* @__PURE__ */ jsx4(
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
  return /* @__PURE__ */ jsxs3("div", { children: [
    /* @__PURE__ */ jsx4("div", { className: "mb-1 text-xs text-[var(--color-text-muted)]", children: label }),
    /* @__PURE__ */ jsx4("div", { className: "text-sm text-[var(--color-text-secondary)]", children: value || "\u2014" })
  ] });
}
function AccountTab() {
  const { api, manifest, user, setUser } = useFrame();
  if (!user) return null;
  if (manifest.auth === "manager") {
    return /* @__PURE__ */ jsx4("div", { className: "p-6", children: /* @__PURE__ */ jsxs3(Card, { className: "max-w-3xl", children: [
      /* @__PURE__ */ jsx4("p", { className: "mb-4 text-sm text-[var(--color-text-secondary)]", children: "Tvoj \xFA\u010Det spravuje NEX Manager \u2014 meno, e-mail aj heslo sa menia tam." }),
      /* @__PURE__ */ jsxs3("div", { className: "grid grid-cols-2 gap-3", children: [
        /* @__PURE__ */ jsx4(ReadOnlyField, { label: "Meno a priezvisko", value: personName(user) }),
        /* @__PURE__ */ jsx4(ReadOnlyField, { label: "E-mail", value: user.email }),
        /* @__PURE__ */ jsx4(ReadOnlyField, { label: "Pou\u017E\xEDvate\u013Esk\xE9 meno", value: user.username }),
        /* @__PURE__ */ jsx4(ReadOnlyField, { label: "Rola", value: roleLabel(user.role) })
      ] })
    ] }) });
  }
  return /* @__PURE__ */ jsx4(
    MyAccountPanel,
    {
      user: {
        username: user.username,
        role: user.role,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name
      },
      roleLabel: roleLabel(user.role),
      telegram: false,
      passwordMinLength: PASSWORD_MIN_LENGTH,
      onSaveProfile: async ({ email, first_name, last_name }) => {
        setUser(await api.updateMe({ email, first_name, last_name }));
      },
      onChangePassword: (current, next) => api.changePassword(current, next)
    }
  );
}
function UsersTab() {
  const { api, isAdmin } = useFrame();
  const [users, setUsers] = useState3([]);
  useEffect3(() => {
    api.listUsers().then(setUsers).catch(() => setUsers([]));
  }, [api]);
  const replace = (row) => setUsers((prev) => prev.map((u) => u.id === row.id ? row : u));
  return /* @__PURE__ */ jsx4(
    UsersPanel,
    {
      users,
      roleOptions: ROLE_OPTIONS,
      canManage: isAdmin,
      fieldSchema: USER_FIELDS,
      onCreate: async (d) => {
        const row = await api.createUser({
          username: d.username,
          email: d.email,
          password: d.password,
          role: d.role,
          first_name: d.first_name,
          last_name: d.last_name,
          is_active: d.is_active
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
            is_active: d.is_active
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
  const { api, manifest, user, isAdmin } = useFrame();
  const [sessions, setSessions] = useState3([]);
  const [users, setUsers] = useState3([]);
  const [loading, setLoading] = useState3(true);
  const [loadError, setLoadError] = useState3("");
  useEffect3(() => {
    api.listSessions().then(setSessions).catch((e) => setLoadError(errorText(e, "Nepodarilo sa na\u010D\xEDta\u0165 rel\xE1cie."))).finally(() => setLoading(false));
    if (isAdmin && manifest.auth === "password") {
      api.listUsers().then(setUsers).catch(() => setUsers([]));
    }
  }, [api, isAdmin, manifest.auth]);
  const names = useMemo2(() => {
    const index = {};
    for (const u of users) index[u.id] = personName(u);
    if (user) index[user.id] = personName(user);
    return index;
  }, [users, user]);
  return /* @__PURE__ */ jsx4(
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
      loadError
    }
  );
}
function SettingsPage() {
  const { manifest, user } = useFrame();
  const config = useMemo2(() => settingsConfig(manifest), [manifest]);
  const headerRight = user ? /* @__PURE__ */ jsxs3("span", { className: "text-xs text-[var(--color-text-muted)]", children: [
    "Prihl\xE1sen\xFD ako ",
    /* @__PURE__ */ jsx4("span", { className: "font-medium text-[var(--color-text-secondary)]", children: user.username }),
    " \xB7 ",
    /* @__PURE__ */ jsx4("span", { className: "text-[11px] font-medium", children: roleLabel(user.role) })
  ] }) : void 0;
  return /* @__PURE__ */ jsx4(
    SettingsShell,
    {
      config,
      currentUserRole: user?.role ?? "",
      title: "Nastavenia",
      headerRight,
      panels: {
        system: /* @__PURE__ */ jsx4(SystemTab, {}),
        agents: /* @__PURE__ */ jsx4(AgentsTab, {}),
        konto: /* @__PURE__ */ jsx4(AccountTab, {}),
        users: /* @__PURE__ */ jsx4(UsersTab, {}),
        sessions: /* @__PURE__ */ jsx4(SessionsTab, {})
      }
    }
  );
}

// src/templates/nsv-standard/pages/UpdatesPage.tsx
import { useCallback as useCallback3, useEffect as useEffect4, useState as useState4 } from "react";
import { ReleaseNotes } from "nex-shared";
import { jsx as jsx5 } from "react/jsx-runtime";
function UpdatesPage() {
  const { api, manifest } = useFrame();
  const [notes, setNotes] = useState4([]);
  const [loading, setLoading] = useState4(true);
  const [error, setError] = useState4("");
  const refresh = useCallback3(async () => {
    setLoading(true);
    setError("");
    try {
      setNotes(await api.releaseNotes());
    } catch (e) {
      setError(errorText(e, "Na\u010D\xEDtanie aktualiz\xE1ci\xED zlyhalo."));
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect4(() => {
    void refresh();
  }, [refresh]);
  return /* @__PURE__ */ jsx5(
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
  overview: { path: "/", label: "Preh\u013Ead", icon: "\u{1F3E0}" },
  gettingStarted: { path: "/getting-started", label: "Ako za\u010Da\u0165", icon: "\u{1F9ED}" },
  updates: { path: "/updates", label: "Aktualiz\xE1cie", icon: "\u2728" },
  settings: { path: "/settings", label: "Nastavenia", icon: "\u2699\uFE0F" }
};

// src/templates/nsv-standard/Shell.tsx
import { useEffect as useEffect6 } from "react";
import { Outlet } from "react-router-dom";
import { useStore as useStore2 } from "zustand";
import { AppShell } from "nex-shared";

// src/templates/nsv-standard/PageErrorBoundary.tsx
import { Component } from "react";
import { useLocation } from "react-router-dom";
import { jsx as jsx6, jsxs as jsxs4 } from "react/jsx-runtime";
var Boundary = class extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return /* @__PURE__ */ jsxs4("div", { role: "alert", className: "m-4 rounded-xl border border-[var(--color-state-error-fg)]/40 bg-[var(--color-state-error-bg)] p-4", children: [
      /* @__PURE__ */ jsx6("h2", { className: "text-sm font-semibold text-[var(--color-state-error-fg)]", children: "\u26A0\uFE0F Str\xE1nka narazila na chybu" }),
      /* @__PURE__ */ jsx6("p", { className: "mt-2 text-sm text-[var(--color-text-primary)]", children: "T\xFAto str\xE1nku sa nepodarilo zobrazi\u0165. Sk\xFAs ju obnovi\u0165; ak sa to opakuje, povedz o tom spr\xE1vcovi aplik\xE1cie." }),
      /* @__PURE__ */ jsx6("p", { className: "mt-1 font-mono text-[11px] text-[var(--color-text-muted)]", children: error.message }),
      /* @__PURE__ */ jsx6(
        "button",
        {
          type: "button",
          onClick: () => window.location.reload(),
          className: "mt-3 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]",
          children: "Obnovi\u0165"
        }
      )
    ] });
  }
};
function PageErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return /* @__PURE__ */ jsx6(Boundary, { children }, pathname);
}

// src/templates/nsv-standard/Sidebar.tsx
import { useLocation as useLocation2, useNavigate } from "react-router-dom";
import { useStore } from "zustand";
import { Brand, NavIcon, NavItem, SectionDivider, Sidebar, UserCard, useShell } from "nex-shared";

// src/frame/version.ts
import { useEffect as useEffect5, useState as useState5 } from "react";
function versionLine(backend, frontend) {
  const be = (backend ?? "").trim();
  const fe = (frontend ?? "").trim();
  if (!be) return fe ? `v${fe}` : void 0;
  if (!fe || fe === be) return `v${be}`;
  return `backend v${be} \xB7 frontend v${fe}`;
}
function useBackendVersion(api) {
  const [version, setVersion] = useState5();
  useEffect5(() => {
    let live = true;
    api.health().then((h) => live && setVersion(h.version)).catch(() => void 0);
    return () => {
      live = false;
    };
  }, [api]);
  return version;
}

// src/templates/nsv-standard/Sidebar.tsx
import { jsx as jsx7, jsxs as jsxs5 } from "react/jsx-runtime";
function useIsActive() {
  const { pathname } = useLocation2();
  return (path) => path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`);
}
function CountedEntry({ entry, active, onClick }) {
  const count = entry.useCount?.() ?? void 0;
  return /* @__PURE__ */ jsx7(NavItem, { icon: /* @__PURE__ */ jsx7(NavIcon, { glyph: entry.icon }), label: entry.label, active, onClick, count: count ?? void 0 });
}
function NsvSidebar() {
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
  const footer = /* @__PURE__ */ jsx7(
    UserCard,
    {
      initials: name ? name.slice(0, 1).toUpperCase() : "?",
      name: name || "\u2014",
      subtitle: roleLabel(user?.role),
      onLogout
    }
  );
  const entry = (place) => /* @__PURE__ */ jsx7(
    NavItem,
    {
      icon: /* @__PURE__ */ jsx7(NavIcon, { glyph: place.icon }),
      label: place.label,
      active: isActive(place.path),
      onClick: () => navigate(place.path)
    },
    place.path
  );
  const modules = manifest.modules.flatMap((id) => MODULES[id] ? [MODULES[id]] : []);
  const ownEntries = manifest.nav.filter((e) => !e.adminOnly || isAdmin);
  return /* @__PURE__ */ jsxs5(
    Sidebar,
    {
      collapsed: railCollapsed && !narrow,
      onToggleCollapse: () => void saveLayout({ sidebar_collapsed: !railCollapsed }),
      logo: /* @__PURE__ */ jsx7(Brand, { initials: manifest.initials, name: manifest.name, version: versionLine(backendVersion, frontendVersion) }),
      footer,
      dense: true,
      width: layout?.sidebar_width ?? void 0,
      onWidthChange: limit ? (w) => void saveLayout({ sidebar_width: w === limit.default ? null : w }) : void 0,
      minWidth: limit?.min,
      maxWidth: limit?.max,
      defaultWidth: limit?.default,
      children: [
        entry(TEMPLATE_PLACES.overview),
        entry(TEMPLATE_PLACES.gettingStarted),
        modules.map((m) => entry(m)),
        ownEntries.map(
          (e) => e.useCount ? /* @__PURE__ */ jsx7(CountedEntry, { entry: e, active: isActive(e.path), onClick: () => navigate(e.path) }, e.path) : entry(e)
        ),
        entry(TEMPLATE_PLACES.updates),
        /* @__PURE__ */ jsx7(SectionDivider, {}),
        entry(TEMPLATE_PLACES.settings)
      ]
    }
  );
}

// src/templates/nsv-standard/Topbar.tsx
import { useLocation as useLocation3 } from "react-router-dom";
import { Header, ThemeToggle } from "nex-shared";
import { jsx as jsx8, jsxs as jsxs6 } from "react/jsx-runtime";
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
  const { manifest } = useFrame();
  const { pathname } = useLocation3();
  const { isDark, toggleDark } = useTheme();
  return /* @__PURE__ */ jsx8(
    Header,
    {
      left: /* @__PURE__ */ jsxs6("div", { className: "flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden text-xs text-[var(--color-text-muted)]", children: [
        /* @__PURE__ */ jsx8("span", { className: "text-[var(--color-text-muted)]", children: "/" }),
        /* @__PURE__ */ jsx8("span", { className: "text-[var(--color-text-secondary)] truncate", children: placeLabel(pathname, manifest) })
      ] }),
      right: /* @__PURE__ */ jsx8(ThemeToggle, { theme: isDark ? "dark" : "light", onToggle: toggleDark })
    }
  );
}

// src/templates/nsv-standard/Shell.tsx
import { jsx as jsx9 } from "react/jsx-runtime";
function NsvShell() {
  const { user, layout } = useFrame();
  const load = useStore2(layout, (s) => s.load);
  const reset = useStore2(layout, (s) => s.reset);
  const userId = user?.id;
  useEffect6(() => {
    reset();
    if (userId) void load();
  }, [userId, load, reset]);
  return /* @__PURE__ */ jsx9(AppShell, { sidebar: /* @__PURE__ */ jsx9(NsvSidebar, {}), header: /* @__PURE__ */ jsx9(NsvTopbar, {}), children: /* @__PURE__ */ jsx9(PageErrorBoundary, { children: /* @__PURE__ */ jsx9(Outlet, {}) }) });
}

// src/templates/nsv-standard/NsvStandard.tsx
import { jsx as jsx10, jsxs as jsxs7 } from "react/jsx-runtime";
function Padded({ children }) {
  return /* @__PURE__ */ jsx10("div", { className: "p-6", children: children ?? /* @__PURE__ */ jsx10(Outlet2, {}) });
}
function NsvStandard({ overview, children }) {
  const { manifest } = useFrame();
  const modules = manifest.modules.flatMap((id) => MODULES[id] ? [MODULES[id]] : []);
  return /* @__PURE__ */ jsx10(Routes, { children: /* @__PURE__ */ jsxs7(Route, { element: /* @__PURE__ */ jsx10(NsvShell, {}), children: [
    /* @__PURE__ */ jsx10(Route, { path: TEMPLATE_PLACES.updates.path, element: /* @__PURE__ */ jsx10(UpdatesPage, {}) }),
    /* @__PURE__ */ jsx10(Route, { path: TEMPLATE_PLACES.settings.path, element: /* @__PURE__ */ jsx10(SettingsPage, {}) }),
    /* @__PURE__ */ jsxs7(Route, { element: /* @__PURE__ */ jsx10(Padded, {}), children: [
      /* @__PURE__ */ jsx10(Route, { index: true, element: overview }),
      /* @__PURE__ */ jsx10(Route, { path: TEMPLATE_PLACES.gettingStarted.path, element: /* @__PURE__ */ jsx10(GettingStartedPage, {}) }),
      modules.map((m) => /* @__PURE__ */ jsx10(Route, { path: `${m.path}/*`, element: m.page() }, m.id)),
      children,
      /* @__PURE__ */ jsx10(Route, { path: "*", element: /* @__PURE__ */ jsx10(NotFoundPage, {}) })
    ] })
  ] }) });
}

// src/templates/registry.ts
var TEMPLATES = Object.freeze({
  "nsv-standard": NsvStandard
});

// src/TemplateApp.tsx
import { jsx as jsx11 } from "react/jsx-runtime";
function TemplateApp({ manifest, client, user, onLogout, frontendVersion, overview, children }) {
  const api = useMemo3(() => createStandardApi(client), [client]);
  const [layout] = useState6(() => createLayoutStore(api));
  const [current, setCurrent] = useState6(user);
  useEffect7(() => setCurrent(user), [user]);
  const frame = useMemo3(
    () => ({
      manifest,
      api,
      user: current,
      setUser: setCurrent,
      isAdmin: current?.role === ADMIN_ROLE,
      onLogout,
      frontendVersion,
      layout
    }),
    [manifest, api, current, onLogout, frontendVersion, layout]
  );
  const Template = TEMPLATES[manifest.template];
  return /* @__PURE__ */ jsx11(FrameContext.Provider, { value: frame, children: /* @__PURE__ */ jsx11(ThemeProvider, { username: current?.username, children: /* @__PURE__ */ jsx11(Template, { overview, children }) }) });
}
export {
  ADMIN_ROLE,
  MODULES,
  ManifestError,
  NAV_LABEL_MAX,
  PASSWORD_MIN_LENGTH,
  STANDARD_ENDPOINTS,
  STANDARD_ROLES,
  TEMPLATES,
  TEMPLATE_IDS,
  TEMPLATE_PATHS,
  TemplateApp,
  createStandardApi,
  defineApp,
  personName,
  roleLabel,
  useFrame
};
