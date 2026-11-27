// DEV-251 — the standard server interface every app on a template answers (KONTRAKT.md). The table below is the one
// source: the frame calls only what it names, the contract document must list exactly these rows (a test compares
// them), and the server package (phase 2) implements the same table.
import type { ApiClient, ReleaseNote, SystemSettingRead, UserRead, UserSessionRead } from "nex-shared";

/** The two roles of an app on a template; the server refuses everything else. */
export const STANDARD_ROLES = [
  // DEV-394: the label is a key of the template's catalogs — shown in the person's language.
  { value: "admin", label: "kit.role.admin" },
  { value: "user", label: "kit.role.user" },
] as const;

export const ADMIN_ROLE = "admin";

/** The shortest password the server accepts — one character: only an empty password is refused (the Director's rule,
 * DEV-296). The forms say the same before sending. */
export const PASSWORD_MIN_LENGTH = 1;

/** When an app has the endpoint: always, with its own password (users live in the app), launched from NEX Manager,
 *  with AI agents, or with a web (DEV-523) — the column „kedy“ of KONTRAKT.md. */
export type EndpointScope = "always" | "password" | "manager" | "ai" | "web";

export const STANDARD_ENDPOINTS = [
  { id: "login", method: "POST", path: "/auth/login", scope: "password" },
  { id: "logout", method: "POST", path: "/auth/logout", scope: "always" },
  // The browser comes here from NEX Manager with the launch ticket — the frame never calls these.
  { id: "launch", method: "GET", path: "/launch", scope: "manager" },
  { id: "launchPost", method: "POST", path: "/launch", scope: "manager" },
  { id: "health", method: "GET", path: "/health", scope: "always" },
  { id: "me", method: "GET", path: "/auth/me", scope: "always" },
  { id: "updateMe", method: "PATCH", path: "/auth/me", scope: "password" },
  { id: "changePassword", method: "POST", path: "/auth/change-password", scope: "password" },
  // DEV-394: the person's language — kept with the person; launched from NEX Manager, the Manager says it.
  { id: "setLanguage", method: "PUT", path: "/auth/language", scope: "password" },
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
  { id: "gettingStarted", method: "GET", path: "/getting-started", scope: "always" },
  // DEV-377: whom the installation serves — and its installed-app description, which the browser reads by the link in
  // the page's head (the frame points the link there and never calls it itself).
  { id: "installation", method: "GET", path: "/installation", scope: "always" },
  { id: "installationManifest", method: "GET", path: "/installation/manifest.webmanifest", scope: "always" },
  // DEV-523: the web (web/) — its own accounts signed in by e-mail, a registration request the admin decides.
  { id: "webRegister", method: "POST", path: "/web/auth/register", scope: "web" },
  { id: "webLogin", method: "POST", path: "/web/auth/login", scope: "web" },
  { id: "webMe", method: "GET", path: "/web/auth/me", scope: "web" },
  { id: "webLogout", method: "POST", path: "/web/auth/logout", scope: "web" },
  { id: "listWebAccounts", method: "GET", path: "/web-accounts", scope: "web" },
  { id: "approveWebAccount", method: "POST", path: "/web-accounts/{id}/approve", scope: "web" },
  { id: "rejectWebAccount", method: "POST", path: "/web-accounts/{id}/reject", scope: "web" },
  { id: "disableWebAccount", method: "POST", path: "/web-accounts/{id}/disable", scope: "web" },
  { id: "enableWebAccount", method: "POST", path: "/web-accounts/{id}/enable", scope: "web" },
] as const satisfies readonly { id: string; method: string; path: string; scope: EndpointScope }[];

export type EndpointId = (typeof STANDARD_ENDPOINTS)[number]["id"];

export interface HealthRead {
  status: string;
  version: string;
  checks?: Record<string, string>;
}

/** The signed-in user; `must_change_password` sends them to Moje konto first. */
export interface CurrentUser extends UserRead {
  must_change_password?: boolean;
  /** DEV-394 — the language the person chose; none: the installation's. */
  language?: string | null;
}

export interface ProfileChanges {
  email: string;
  first_name: string;
  last_name: string;
}

export interface NewUser {
  username: string;
  email: string;
  password: string;
  role: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  /** DEV-415 — one of the app's languages; absent: the person follows the installation's. */
  language?: string;
}

export interface UserChanges {
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  /** DEV-415 — the person's new language; absent: unchanged. */
  language?: string;
}

/** A signed-in browser — the server keeps sessions in its database, without a token version. */
export interface SessionRead extends UserSessionRead {
  username: string | null;
  expires_at: string;
  user_agent: string | null;
  /** The session of the browser asking. */
  current: boolean;
}

export interface AgentSettingRead {
  role: string;
  /** A model family (fable, opus, sonnet, haiku), never a version; empty = the app's default. */
  model: string;
  effort: string;
}

export interface AgentModelOption {
  id: string;
  label: string;
}

export interface LayoutLimit {
  min: number;
  max: number;
  default: number;
}

/** The caller's own screen layout; a width of null is the default. The server sets the bounds. */
export interface UserLayout {
  sidebar_width: number | null;
  sidebar_collapsed: boolean;
  limits: { sidebar_width: LayoutLimit };
}

/** Only the fields sent change; a width of null returns to the default. */
export type UserLayoutChanges = Partial<Pick<UserLayout, "sidebar_width" | "sidebar_collapsed">>;

/** „Ako začať“ — the app's own guide, written by the agent into the project's documents. */
export interface GettingStartedRead {
  markdown: string;
}

/** DEV-377: whom the installation serves — written by the cockpit on every deploy; both `null` outside it. */
export interface InstallationRead {
  customer: string | null;
  environment: "uat" | "prod" | null;
  /** DEV-394 — the installation's language for whoever chose none (the customer's, set by the cockpit). */
  language?: string | null;
  /** DEV-394 — the languages the app speaks (its manifest). */
  languages?: string[];
}

/** DEV-523 — an account of the web: `pending` (the request waits for the admin), `active`, `rejected`, `disabled`. */
export type WebAccountStatus = "pending" | "active" | "rejected" | "disabled";

export interface WebAccountRead {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: WebAccountStatus;
  created_at: string | null;
  decided_at: string | null;
}

export interface WebRegistration {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

/** What the admin does with an account of the web — each allowed from one state (KONTRAKT.md → Web). */
export type WebAccountAction = "approve" | "reject" | "disable" | "enable";

export interface StandardApi {
  login(username: string, password: string): Promise<CurrentUser>;
  logout(): Promise<void>;
  health(): Promise<HealthRead>;
  installation(): Promise<InstallationRead>;
  me(): Promise<CurrentUser>;
  updateMe(changes: ProfileChanges): Promise<CurrentUser>;
  setLanguage(language: string): Promise<CurrentUser>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  listUsers(): Promise<UserRead[]>;
  createUser(user: NewUser): Promise<UserRead>;
  updateUser(id: string, changes: UserChanges): Promise<UserRead>;
  deleteUser(id: string): Promise<void>;
  setUserPassword(id: string, newPassword: string): Promise<void>;
  listSessions(): Promise<SessionRead[]>;
  revokeSession(id: string): Promise<void>;
  listSystemSettings(): Promise<SystemSettingRead[]>;
  updateSystemSetting(key: string, value: string): Promise<SystemSettingRead>;
  listAgentSettings(): Promise<AgentSettingRead[]>;
  listAgentModels(): Promise<AgentModelOption[]>;
  saveAgentSetting(role: string, setting: { model: string; effort: string }): Promise<AgentSettingRead>;
  getLayout(): Promise<UserLayout>;
  saveLayout(changes: UserLayoutChanges): Promise<UserLayout>;
  releaseNotes(): Promise<ReleaseNote[]>;
  gettingStarted(): Promise<GettingStartedRead>;
  webRegister(registration: WebRegistration): Promise<WebAccountRead>;
  webLogin(email: string, password: string): Promise<WebAccountRead>;
  webMe(): Promise<WebAccountRead>;
  webLogout(): Promise<void>;
  listWebAccounts(): Promise<WebAccountRead[]>;
  decideWebAccount(id: string, action: WebAccountAction): Promise<WebAccountRead>;
}

const WEB_ACTION_ENDPOINT: Record<WebAccountAction, EndpointId> = {
  approve: "approveWebAccount",
  reject: "rejectWebAccount",
  disable: "disableWebAccount",
  enable: "enableWebAccount",
};

/** The frame's calls, each to the path and method its row in {@link STANDARD_ENDPOINTS} names. */
export function createStandardApi(client: ApiClient): StandardApi {
  function call<T>(id: EndpointId, params: Record<string, string> = {}, body?: unknown): Promise<T> {
    const endpoint = STANDARD_ENDPOINTS.find((e) => e.id === id);
    if (!endpoint) throw new Error(`Unknown standard endpoint: ${id}`);
    const path = endpoint.path.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = params[name];
      if (value === undefined) throw new Error(`Endpoint ${id} needs the path parameter ${name}`);
      return encodeURIComponent(value);
    });
    switch (endpoint.method) {
      case "GET":
        return client.get<T>(path);
      case "DELETE":
        return client.delete<T>(path);
      case "POST":
        return client.post<T>(path, body);
      case "PUT":
        return client.put<T>(path, body);
      case "PATCH":
        return client.patch<T>(path, body);
    }
  }

  return {
    login: (username, password) => call("login", {}, { username, password }),
    logout: () => call("logout"),
    health: () => call("health"),
    installation: () => call("installation"),
    me: () => call("me"),
    updateMe: (changes) => call("updateMe", {}, changes),
    setLanguage: (language) => call("setLanguage", {}, { language }),
    changePassword: (currentPassword, newPassword) =>
      call("changePassword", {}, { current_password: currentPassword, new_password: newPassword }),
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
    gettingStarted: () => call("gettingStarted"),
    webRegister: (registration) => call("webRegister", {}, registration),
    webLogin: (email, password) => call("webLogin", {}, { email, password }),
    webMe: () => call("webMe"),
    webLogout: () => call("webLogout"),
    listWebAccounts: () => call("listWebAccounts"),
    decideWebAccount: (id, action) => call(WEB_ACTION_ENDPOINT[action], { id }),
  };
}
