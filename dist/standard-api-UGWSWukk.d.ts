import { SettingsCategory, UserRead, UserSessionRead, SystemSettingRead, ReleaseNote, ApiClient } from 'nex-shared';

declare const TEMPLATE_IDS: readonly ["nsv-standard"];
type TemplateId = (typeof TEMPLATE_IDS)[number];

/** How people get in: the app's own password, or launched from NEX Manager (no users of its own). */
type AppAuthMode = "password" | "manager";
/** One of the app's own entries in the left panel. */
interface NavEntry {
    label: string;
    /** Starts with „/“; never one of the template's own paths. */
    path: string;
    /** An emoji glyph, as in the cockpit. */
    icon: string;
    /** Shown to an admin only. */
    adminOnly?: boolean;
    /** A hook the panel calls for the count shown beside the label („(3)“); nothing for 0 or none. */
    useCount?: () => number | null | undefined;
}
interface AgentRole {
    id: string;
    label: string;
}
interface AiConfig {
    /** The agents the app runs — each gets its model and effort in Nastavenia → Agenti. */
    roles: AgentRole[];
}
interface AppManifestInput {
    template: string;
    name: string;
    initials: string;
    /** "password" or "manager" — a string here, since app.manifest.json gives a string; checked when the app starts. */
    auth: AppAuthMode | (string & {});
    ai?: AiConfig | false;
    modules?: string[];
    nav?: NavEntry[];
    settings?: {
        categories?: SettingsCategory[];
    };
}
interface AppManifest {
    readonly template: TemplateId;
    readonly name: string;
    readonly initials: string;
    readonly auth: AppAuthMode;
    readonly ai: Readonly<AiConfig> | false;
    readonly modules: readonly string[];
    readonly nav: readonly NavEntry[];
    readonly settings: {
        readonly categories: readonly SettingsCategory[];
    };
}
/** The template's own pages — an app's entry never takes their path. */
declare const TEMPLATE_PATHS: readonly ["/", "/getting-started", "/updates", "/settings"];
/** A left-panel label longer than this does not fit on one line at the default width (ICC layout standard). */
declare const NAV_LABEL_MAX = 22;
/** What JSON cannot hold: the hook that counts what waits behind an entry, by the entry's path. */
interface AppExtras {
    counts?: Record<string, () => number | null | undefined>;
}
declare class ManifestError extends Error {
    readonly problems: string[];
    constructor(problems: string[]);
}
declare function defineApp(input: AppManifestInput, extras?: AppExtras): AppManifest;

/** The two roles of an app on a template; the server refuses everything else. */
declare const STANDARD_ROLES: readonly [{
    readonly value: "admin";
    readonly label: "Správca";
}, {
    readonly value: "user";
    readonly label: "Používateľ";
}];
declare const ADMIN_ROLE = "admin";
/** The shortest password the server accepts — the forms say the same before sending. */
declare const PASSWORD_MIN_LENGTH = 8;
/** When an app has the endpoint: always, with its own password (users live in the app), launched from NEX Manager,
 *  or with AI agents — the column „kedy“ of KONTRAKT.md. */
type EndpointScope = "always" | "password" | "manager" | "ai";
declare const STANDARD_ENDPOINTS: readonly [{
    readonly id: "login";
    readonly method: "POST";
    readonly path: "/auth/login";
    readonly scope: "password";
}, {
    readonly id: "logout";
    readonly method: "POST";
    readonly path: "/auth/logout";
    readonly scope: "always";
}, {
    readonly id: "launch";
    readonly method: "GET";
    readonly path: "/launch";
    readonly scope: "manager";
}, {
    readonly id: "launchPost";
    readonly method: "POST";
    readonly path: "/launch";
    readonly scope: "manager";
}, {
    readonly id: "health";
    readonly method: "GET";
    readonly path: "/health";
    readonly scope: "always";
}, {
    readonly id: "me";
    readonly method: "GET";
    readonly path: "/auth/me";
    readonly scope: "always";
}, {
    readonly id: "updateMe";
    readonly method: "PATCH";
    readonly path: "/auth/me";
    readonly scope: "password";
}, {
    readonly id: "changePassword";
    readonly method: "POST";
    readonly path: "/auth/change-password";
    readonly scope: "password";
}, {
    readonly id: "listUsers";
    readonly method: "GET";
    readonly path: "/users";
    readonly scope: "password";
}, {
    readonly id: "createUser";
    readonly method: "POST";
    readonly path: "/users";
    readonly scope: "password";
}, {
    readonly id: "updateUser";
    readonly method: "PATCH";
    readonly path: "/users/{id}";
    readonly scope: "password";
}, {
    readonly id: "deleteUser";
    readonly method: "DELETE";
    readonly path: "/users/{id}";
    readonly scope: "password";
}, {
    readonly id: "setUserPassword";
    readonly method: "POST";
    readonly path: "/users/{id}/password";
    readonly scope: "password";
}, {
    readonly id: "listSessions";
    readonly method: "GET";
    readonly path: "/sessions";
    readonly scope: "always";
}, {
    readonly id: "revokeSession";
    readonly method: "DELETE";
    readonly path: "/sessions/{id}";
    readonly scope: "always";
}, {
    readonly id: "listSystemSettings";
    readonly method: "GET";
    readonly path: "/system-settings";
    readonly scope: "always";
}, {
    readonly id: "updateSystemSetting";
    readonly method: "PATCH";
    readonly path: "/system-settings/{key}";
    readonly scope: "always";
}, {
    readonly id: "listAgentSettings";
    readonly method: "GET";
    readonly path: "/agent-settings";
    readonly scope: "ai";
}, {
    readonly id: "listAgentModels";
    readonly method: "GET";
    readonly path: "/agent-settings/models";
    readonly scope: "ai";
}, {
    readonly id: "saveAgentSetting";
    readonly method: "PUT";
    readonly path: "/agent-settings/{role}";
    readonly scope: "ai";
}, {
    readonly id: "getLayout";
    readonly method: "GET";
    readonly path: "/user-layout";
    readonly scope: "always";
}, {
    readonly id: "saveLayout";
    readonly method: "PUT";
    readonly path: "/user-layout";
    readonly scope: "always";
}, {
    readonly id: "releaseNotes";
    readonly method: "GET";
    readonly path: "/release-notes";
    readonly scope: "always";
}, {
    readonly id: "gettingStarted";
    readonly method: "GET";
    readonly path: "/getting-started";
    readonly scope: "always";
}];
type EndpointId = (typeof STANDARD_ENDPOINTS)[number]["id"];
interface HealthRead {
    status: string;
    version: string;
    checks?: Record<string, string>;
}
/** The signed-in user; `must_change_password` sends them to Moje konto first. */
interface CurrentUser extends UserRead {
    must_change_password?: boolean;
}
interface ProfileChanges {
    email: string;
    first_name: string;
    last_name: string;
}
interface NewUser {
    username: string;
    email: string;
    password: string;
    role: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
}
interface UserChanges {
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
}
/** A signed-in browser — the server keeps sessions in its database, without a token version. */
interface SessionRead extends UserSessionRead {
    username: string | null;
    expires_at: string;
    user_agent: string | null;
    /** The session of the browser asking. */
    current: boolean;
}
interface AgentSettingRead {
    role: string;
    /** A model family (opus, sonnet, haiku), never a version; empty = the app's default. */
    model: string;
    effort: string;
}
interface AgentModelOption {
    id: string;
    label: string;
}
interface LayoutLimit {
    min: number;
    max: number;
    default: number;
}
/** The caller's own screen layout; a width of null is the default. The server sets the bounds. */
interface UserLayout {
    sidebar_width: number | null;
    sidebar_collapsed: boolean;
    limits: {
        sidebar_width: LayoutLimit;
    };
}
/** Only the fields sent change; a width of null returns to the default. */
type UserLayoutChanges = Partial<Pick<UserLayout, "sidebar_width" | "sidebar_collapsed">>;
/** „Ako začať“ — the app's own guide, written by the agent into the project's documents. */
interface GettingStartedRead {
    markdown: string;
}
interface StandardApi {
    login(username: string, password: string): Promise<CurrentUser>;
    logout(): Promise<void>;
    health(): Promise<HealthRead>;
    me(): Promise<CurrentUser>;
    updateMe(changes: ProfileChanges): Promise<CurrentUser>;
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
    saveAgentSetting(role: string, setting: {
        model: string;
        effort: string;
    }): Promise<AgentSettingRead>;
    getLayout(): Promise<UserLayout>;
    saveLayout(changes: UserLayoutChanges): Promise<UserLayout>;
    releaseNotes(): Promise<ReleaseNote[]>;
    gettingStarted(): Promise<GettingStartedRead>;
}
/** The frame's calls, each to the path and method its row in {@link STANDARD_ENDPOINTS} names. */
declare function createStandardApi(client: ApiClient): StandardApi;

export { type AppManifest as A, type CurrentUser as C, type EndpointId as E, type GettingStartedRead as G, type HealthRead as H, type LayoutLimit as L, ManifestError as M, NAV_LABEL_MAX as N, PASSWORD_MIN_LENGTH as P, type StandardApi as S, type TemplateId as T, type UserLayout as U, type UserLayoutChanges as a, ADMIN_ROLE as b, type AgentModelOption as c, type AgentRole as d, type AgentSettingRead as e, type AiConfig as f, type AppAuthMode as g, type AppManifestInput as h, type EndpointScope as i, type NavEntry as j, type NewUser as k, type ProfileChanges as l, STANDARD_ENDPOINTS as m, STANDARD_ROLES as n, TEMPLATE_IDS as o, TEMPLATE_PATHS as p, type UserChanges as q, createStandardApi as r, defineApp as s };
