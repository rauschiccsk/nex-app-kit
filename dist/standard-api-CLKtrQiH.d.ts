import { ReactNode } from 'react';
import { SettingsCategory, UserRead, Language, AppMessages, UserSessionRead, SystemSettingRead, ReleaseNote, ApiClient } from 'nex-shared';

/** One step of the catalog. Texts are keys of the app's own texts (or plain text). */
interface GuideStep {
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
interface GuideSubjectKind {
    list: () => Promise<{
        id: string;
        label: string;
    }[]>;
}
interface GuideCatalog {
    steps: GuideStep[];
    subjects?: Record<string, GuideSubjectKind>;
}
/** The attribute marking a step's button on its screen: `<Button {...guideTarget("etalon.upload")}>`. */
declare function guideTarget(id: string): {
    "data-guide": string;
};
/** What the server is sent: the steps with what the screen measured, and the objects there are. */
interface MeasuredCatalog {
    catalog: {
        id: string;
        title: string;
        hint: string;
        screen: string;
        subject_kind: string | null;
        requires: string[];
        state: Record<string, {
            available: boolean;
            done: boolean;
        }>;
    }[];
    subjects: Record<string, {
        id: string;
        label: string;
    }[]>;
}

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
    /** DEV-257: a hook the panel calls whether to show the entry at all — for an entry only some people have (NEX
     *  Knowledge's Uchovávanie for its statutory persons). Shown only when it says `true`; while it does not know yet,
     *  the entry stays hidden. The app still guards the page itself on its server. */
    useVisible?: () => boolean | null | undefined;
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
    /** DEV-394 — the languages the app speaks, its main one first (default: Slovak only). */
    languages?: string[];
    /** DEV-523 — the app has a web (web/) beside its administration: own accounts, sign-in by e-mail. */
    web?: boolean;
    /** DEV-535 — Sprievodca; on unless `false` (the cockpit switches it off for a special app). */
    guide?: boolean;
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
    /** The app's own action for one person in Nastavenia → Používatelia (DEV-293). */
    readonly userActions?: (user: UserRead) => ReactNode;
    /** DEV-368: whether the person sees Prehľad — the hook the app gave for „/“; none: everyone sees it. */
    readonly overviewVisible?: () => boolean | null | undefined;
    /** DEV-394 — the languages the app speaks, its main one first. */
    readonly languages: readonly Language[];
    /** DEV-394 — the app's own texts per language (labels of the left panel, its screens); keys, not words. */
    readonly messages: AppMessages;
    /** DEV-523 — the app has a web (web/): Nastavenia show its accounts and the requests to decide. */
    readonly web: boolean;
    /** DEV-535 — Sprievodca is on: „Ako urobiť“ with its chat, its button in the top bar, its tab in Nastavenia. */
    readonly guide: boolean;
    /** DEV-535 — the steps Sprievodca guides through (the app's `guide` in `defineApp`); empty: it says it has none. */
    readonly guideCatalog: GuideCatalog;
}
/** The template's own pages — an app's entry never takes their path. */
declare const TEMPLATE_PATHS: readonly ["/", "/getting-started", "/updates", "/settings"];
/** A left-panel label longer than this does not fit on one line at the default width (ICC layout standard). */
declare const NAV_LABEL_MAX = 22;
/** What JSON cannot hold, by the entry's path: the hook that counts what waits behind it, and the one that says
 *  whether the person sees it (DEV-257) — for „/“ whether the person sees Prehľad, the template's own entry and first
 *  screen (DEV-368). */
interface AppExtras {
    counts?: Record<string, () => number | null | undefined>;
    visible?: Record<string, () => boolean | null | undefined>;
    /** The app's own action for one person, first in their row of Nastavenia → Používatelia — NEX Manager's „Prístupy“.
     *  Everything about people stays in that one tab; what a viewer who may not manage people sees, the app decides
     *  (DEV-293). */
    userActions?: (user: UserRead) => ReactNode;
    /** DEV-394 — the app's own texts per language (`src/locales`); a label of the left panel may be one of their keys. */
    messages?: AppMessages;
    /** DEV-535 — the catalog of steps Sprievodca guides through (`guide/catalog.ts`); checked when the app starts. */
    guide?: GuideCatalog;
}
declare class ManifestError extends Error {
    readonly problems: string[];
    constructor(problems: string[]);
}
declare function defineApp(input: AppManifestInput, extras?: AppExtras): AppManifest;

/** The two roles of an app on a template; the server refuses everything else. */
declare const STANDARD_ROLES: readonly [{
    readonly value: "admin";
    readonly label: "kit.role.admin";
}, {
    readonly value: "user";
    readonly label: "kit.role.user";
}];
declare const ADMIN_ROLE = "admin";
/** The shortest password the server accepts — one character: only an empty password is refused (the Director's rule,
 * DEV-296). The forms say the same before sending. */
declare const PASSWORD_MIN_LENGTH = 1;
/** When an app has the endpoint: always, with its own password (users live in the app), launched from NEX Manager,
 *  with AI agents, or with a web (DEV-523) — the column „kedy“ of KONTRAKT.md. */
type EndpointScope = "always" | "password" | "manager" | "ai" | "web" | "guide";
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
    readonly id: "setLanguage";
    readonly method: "PUT";
    readonly path: "/auth/language";
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
}, {
    readonly id: "installation";
    readonly method: "GET";
    readonly path: "/installation";
    readonly scope: "always";
}, {
    readonly id: "installationManifest";
    readonly method: "GET";
    readonly path: "/installation/manifest.webmanifest";
    readonly scope: "always";
}, {
    readonly id: "webRegister";
    readonly method: "POST";
    readonly path: "/web/auth/register";
    readonly scope: "web";
}, {
    readonly id: "webLogin";
    readonly method: "POST";
    readonly path: "/web/auth/login";
    readonly scope: "web";
}, {
    readonly id: "webMe";
    readonly method: "GET";
    readonly path: "/web/auth/me";
    readonly scope: "web";
}, {
    readonly id: "webLogout";
    readonly method: "POST";
    readonly path: "/web/auth/logout";
    readonly scope: "web";
}, {
    readonly id: "listWebAccounts";
    readonly method: "GET";
    readonly path: "/web-accounts";
    readonly scope: "web";
}, {
    readonly id: "approveWebAccount";
    readonly method: "POST";
    readonly path: "/web-accounts/{id}/approve";
    readonly scope: "web";
}, {
    readonly id: "rejectWebAccount";
    readonly method: "POST";
    readonly path: "/web-accounts/{id}/reject";
    readonly scope: "web";
}, {
    readonly id: "disableWebAccount";
    readonly method: "POST";
    readonly path: "/web-accounts/{id}/disable";
    readonly scope: "web";
}, {
    readonly id: "enableWebAccount";
    readonly method: "POST";
    readonly path: "/web-accounts/{id}/enable";
    readonly scope: "web";
}, {
    readonly id: "guidePlan";
    readonly method: "POST";
    readonly path: "/guide/plan";
    readonly scope: "guide";
}, {
    readonly id: "guideProgress";
    readonly method: "POST";
    readonly path: "/guide/sessions/{id}/progress";
    readonly scope: "guide";
}, {
    readonly id: "guideRate";
    readonly method: "POST";
    readonly path: "/guide/sessions/{id}/rating";
    readonly scope: "guide";
}, {
    readonly id: "guideEvent";
    readonly method: "POST";
    readonly path: "/guide/events";
    readonly scope: "guide";
}, {
    readonly id: "guideFeedback";
    readonly method: "GET";
    readonly path: "/guide/feedback";
    readonly scope: "guide";
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
    /** DEV-394 — the language the person chose; none: the installation's. */
    language?: string | null;
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
    /** DEV-415 — one of the app's languages; absent: the person follows the installation's. */
    language?: string;
}
interface UserChanges {
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    /** DEV-415 — the person's new language; absent: unchanged. */
    language?: string;
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
    /** A model family (fable, opus, sonnet, haiku), never a version; empty = the app's default. */
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
/** DEV-377: whom the installation serves — written by the cockpit on every deploy; both `null` outside it. */
interface InstallationRead {
    customer: string | null;
    environment: "uat" | "prod" | null;
    /** DEV-394 — the installation's language for whoever chose none (the customer's, set by the cockpit). */
    language?: string | null;
    /** DEV-394 — the languages the app speaks (its manifest). */
    languages?: string[];
}
/** DEV-523 — an account of the web: `pending` (the request waits for the admin), `active`, `rejected`, `disabled`. */
type WebAccountStatus = "pending" | "active" | "rejected" | "disabled";
interface WebAccountRead {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
    status: WebAccountStatus;
    created_at: string | null;
    decided_at: string | null;
}
interface WebRegistration {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
}
/** What the admin does with an account of the web — each allowed from one state (KONTRAKT.md → Web). */
type WebAccountAction = "approve" | "reject" | "disable" | "enable";
interface StandardApi {
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
    saveAgentSetting(role: string, setting: {
        model: string;
        effort: string;
    }): Promise<AgentSettingRead>;
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
    guidePlan(body: GuidePlanBody): Promise<GuidePlanRead>;
    guideProgress(sessionId: string, status: "guiding" | "done" | "stopped", currentStep: number, reason?: GuideStopReason): Promise<GuideSessionRead>;
    guideRate(sessionId: string, rating: "up" | "down", comment?: string): Promise<GuideSessionRead>;
    guideEvent(event: GuideEventBody): Promise<{
        recorded: string;
    }>;
    guideFeedback(): Promise<GuideFeedbackRead>;
}
type GuideStopReason = "unclear" | "did_otherwise" | "not_needed";
type GuideEventKind = "stuck" | "not_detected" | "no_target" | "skipped" | "idea";
interface GuidePathStep {
    id: string;
    subject: string | null;
    title: string;
}
interface GuidePlanBody extends MeasuredCatalog {
    message: string;
    session_id?: string;
    language?: string;
}
interface GuidePlanRead {
    session_id: string;
    kind: "plan" | "question" | "missing";
    text: string;
    steps: GuidePathStep[];
    invalid: boolean;
    empty_catalog: boolean;
}
interface GuideSessionRead {
    id: string;
    goal: string;
    status: "asking" | "planned" | "missing" | "guiding" | "done" | "stopped";
    steps: GuidePathStep[];
    current_step: number;
    stop_reason: GuideStopReason | null;
    rating: "up" | "down" | null;
    comment: string | null;
    created_at: string | null;
}
interface GuideEventBody {
    kind: GuideEventKind;
    session_id?: string;
    step_id?: string;
    detail?: string;
}
interface GuideFeedbackRead {
    totals: {
        sessions: number;
        done: number;
        stopped: number;
        missing: number;
        guiding: number;
        rated_up: number;
        rated_down: number;
    };
    sessions: GuideSessionRead[];
    events: {
        kind: string;
        step_id: string | null;
        detail: string | null;
        goal: string | null;
        created_at: string | null;
    }[];
}
/** The frame's calls, each to the path and method its row in {@link STANDARD_ENDPOINTS} names. */
declare function createStandardApi(client: ApiClient): StandardApi;

export { type AppManifest as A, type CurrentUser as C, type EndpointId as E, type GettingStartedRead as G, type HealthRead as H, type LayoutLimit as L, ManifestError as M, NAV_LABEL_MAX as N, PASSWORD_MIN_LENGTH as P, type StandardApi as S, type TemplateId as T, type UserLayout as U, type WebAccountRead as W, type UserLayoutChanges as a, ADMIN_ROLE as b, type AgentModelOption as c, type AgentRole as d, type AgentSettingRead as e, type AiConfig as f, type AppAuthMode as g, type AppManifestInput as h, type EndpointScope as i, type GuideCatalog as j, type GuideStep as k, type GuideSubjectKind as l, type NavEntry as m, type NewUser as n, type ProfileChanges as o, STANDARD_ENDPOINTS as p, STANDARD_ROLES as q, TEMPLATE_IDS as r, TEMPLATE_PATHS as s, type UserChanges as t, type WebAccountAction as u, type WebAccountStatus as v, type WebRegistration as w, createStandardApi as x, defineApp as y, guideTarget as z };
