import { A as AppManifest, U as UserLayout, a as UserLayoutChanges, S as StandardApi, C as CurrentUser, T as TemplateId } from './standard-api-DgTwrpJ3.js';
export { b as ADMIN_ROLE, c as AgentModelOption, d as AgentRole, e as AgentSettingRead, f as AiConfig, g as AppAuthMode, h as AppManifestInput, E as EndpointId, i as EndpointScope, G as GettingStartedRead, H as HealthRead, L as LayoutLimit, M as ManifestError, N as NAV_LABEL_MAX, j as NavEntry, k as NewUser, P as PASSWORD_MIN_LENGTH, l as ProfileChanges, m as STANDARD_ENDPOINTS, n as STANDARD_ROLES, o as TEMPLATE_IDS, p as TEMPLATE_PATHS, q as UserChanges, r as createStandardApi, s as defineApp } from './standard-api-DgTwrpJ3.js';
import * as react from 'react';
import { ReactNode, ComponentType } from 'react';
import { ApiClient, Translate, AppMessages, Language } from 'nex-shared';
import { StoreApi } from 'zustand';

interface ModuleDefinition {
    id: string;
    label: string;
    icon: string;
    /** Where the module's page lives — never one of the template's own paths. */
    path: string;
    page: () => ReactNode;
}
declare const MODULES: Readonly<Record<string, ModuleDefinition>>;

interface TemplateAppProps {
    manifest: AppManifest;
    /** The app's API client; by default one for the same address, prefix /api/v1, with the session cookie. */
    client?: ApiClient;
    /** The frontend's build version (e.g. import.meta.env.VITE_APP_VERSION). */
    frontendVersion?: string;
    /** Prehľad — the app's own overview. */
    overview: ReactNode;
    /** The app's own pages as <Route> elements. */
    children?: ReactNode;
}
declare function TemplateApp({ manifest, client, frontendVersion, overview, children }: TemplateAppProps): react.JSX.Element;

interface LayoutState {
    /** `null` until read from the server; the screen keeps its defaults meanwhile. */
    layout: UserLayout | null;
    load: () => Promise<void>;
    save: (changes: UserLayoutChanges) => Promise<void>;
    /** Another person signs in — nothing of the previous one's layout stays. */
    reset: () => void;
}

interface Frame {
    manifest: AppManifest;
    api: StandardApi;
    /** The signed-in person as the frame knows them now — a change in Moje konto shows at once. */
    user: CurrentUser | null;
    setUser: (user: CurrentUser) => void;
    isAdmin: boolean;
    /** Nothing for an app that has no logout (launched from NEX Manager): the footer then has no logout button. */
    onLogout?: () => void;
    /** The frontend's own version, when the app passes it — the brand then says when it differs from the server's. */
    frontendVersion?: string;
    layout: StoreApi<LayoutState>;
}
declare function useFrame(): Frame;

/** First and last name, else the login; empty when nobody is signed in (the caller chooses the placeholder). */
declare function personName(person: {
    first_name?: string | null;
    last_name?: string | null;
    username: string;
} | null | undefined): string;
/** The role's name in the person's language (DEV-394: `t` from `useKitT`; without one, in Slovak). */
declare function roleLabel(role: string | null | undefined, t?: Translate): string;

/** What a template receives from the app beyond the manifest: its overview page and its own routes. */
interface TemplateProps {
    /** Prehľad — the app's own overview. */
    overview: ReactNode;
    /** The app's pages as `<Route>` elements (paths as in the manifest's entries, e.g. `/areas`, `/areas/:id`). */
    children?: ReactNode;
}

declare const TEMPLATES: Readonly<Record<TemplateId, ComponentType<TemplateProps>>>;

declare const kitSk: {
    "kit.error.reload": string;
    "kit.error.text": string;
    "kit.error.title": string;
    "kit.guide.failed": string;
    "kit.guide.none": string;
    "kit.guide.noServer": string;
    "kit.login.failed": string;
    "kit.login.identity": string;
    "kit.login.loading": string;
    "kit.notFound.back": string;
    "kit.notFound.text": string;
    "kit.notFound.title": string;
    "kit.password.failed": string;
    "kit.password.mismatch": string;
    "kit.password.submit": string;
    "kit.password.title": string;
    "kit.password.why": string;
    "kit.place.gettingStarted": string;
    "kit.place.overview": string;
    "kit.place.settings": string;
    "kit.place.updates": string;
    "kit.retry": string;
    "kit.role.admin": string;
    "kit.role.user": string;
    "kit.settings.agentsLoadFailed": string;
    "kit.settings.email": string;
    "kit.settings.fullName": string;
    "kit.settings.loadFailed": string;
    "kit.settings.loginCategory": string;
    "kit.settings.loginCategoryHint": string;
    "kit.settings.managedByManager": string;
    "kit.settings.saveFailed": string;
    "kit.settings.sessionsHint": string;
    "kit.settings.sessionsLoadFailed": string;
    "kit.settings.signedInAs": string;
    "kit.signedOut.managerExpired": string;
    "kit.signedOut.managerLogout": string;
    "kit.signedOut.passwordExpired": string;
    "kit.uat": string;
    "kit.unavailable": string;
    "kit.updates.failed": string;
};
type KitMessageKey = keyof typeof kitSk;

/** The template's own catalogs. */
declare const KIT_MESSAGES: AppMessages;
/** The template's catalogs with the app's over them — the app may say a template's text its own way. */
declare function mergeMessages(app: AppMessages | undefined): AppMessages;
/** The translator of the current language that knows the template's texts too. */
declare function useKitT(): Translate;
/** The person's language: their own choice, else the installation's, else the app's first — one it speaks. */
declare function chooseLanguage(offered: readonly Language[], personal: string | null | undefined, installation: string | null | undefined): Language;

export { AppManifest, CurrentUser, type Frame, KIT_MESSAGES, type KitMessageKey, MODULES, type ModuleDefinition, StandardApi, TEMPLATES, TemplateApp, type TemplateAppProps, TemplateId, type TemplateProps, UserLayout, UserLayoutChanges, chooseLanguage, mergeMessages, personName, roleLabel, useFrame, useKitT };
