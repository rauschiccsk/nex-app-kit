// DEV-251 — the standard server interface every app on a template answers (KONTRAKT.md). The table below is the one
// source: the frame calls only what it names, the contract document must list exactly these rows (a test compares
// them), and the server package (phase 2) implements the same table.
import type {
  ApiClient,
  ReleaseNote,
  SystemSettingRead,
  UserRead,
  UserSessionRead,
} from "nex-shared";

/** When an app has the endpoint: always, with its own password (users live in the app), or with AI agents. */
export type EndpointScope = "always" | "password" | "ai";

export const STANDARD_ENDPOINTS = [
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
  { id: "gettingStarted", method: "GET", path: "/getting-started", scope: "always" },
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
}

export interface UserChanges {
  email: string;
  role: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

export interface AgentSettingRead {
  role: string;
  /** A model family (opus, sonnet, haiku), never a version; empty = the app's default. */
  model: string;
  effort: string;
}

export interface AgentModelOption {
  id: string;
  label: string;
}

/** The caller's own screen layout; a width of null returns to the default. */
export interface UserLayout {
  sidebar_width: number | null;
  sidebar_collapsed: boolean;
}

/** „Ako začať“ — the app's own guide, written by the agent into the project's documents. */
export interface GettingStartedRead {
  markdown: string;
}

export interface StandardApi {
  health(): Promise<HealthRead>;
  me(): Promise<CurrentUser>;
  updateMe(changes: ProfileChanges): Promise<CurrentUser>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  listUsers(): Promise<UserRead[]>;
  createUser(user: NewUser): Promise<UserRead>;
  updateUser(id: string, changes: UserChanges): Promise<UserRead>;
  deleteUser(id: string): Promise<void>;
  setUserPassword(id: string, newPassword: string): Promise<void>;
  listSessions(): Promise<UserSessionRead[]>;
  revokeSession(id: string): Promise<void>;
  listSystemSettings(): Promise<SystemSettingRead[]>;
  updateSystemSetting(key: string, value: string): Promise<SystemSettingRead>;
  listAgentSettings(): Promise<AgentSettingRead[]>;
  listAgentModels(): Promise<AgentModelOption[]>;
  saveAgentSetting(role: string, setting: { model: string; effort: string }): Promise<AgentSettingRead>;
  getLayout(): Promise<UserLayout>;
  saveLayout(changes: Partial<UserLayout>): Promise<UserLayout>;
  releaseNotes(): Promise<ReleaseNote[]>;
  gettingStarted(): Promise<GettingStartedRead>;
}

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
    health: () => call("health"),
    me: () => call("me"),
    updateMe: (changes) => call("updateMe", {}, changes),
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
  };
}
