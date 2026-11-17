// texts: for the agent — the manifest's sentences and the preview's sample data are read by the agent who builds the app (DEV-394).
// DEV-253 — answers for the Vizuál preview, which runs without a server (MSW in the browser). The frame's own routes
// are answered here, so the preview opens signed in, with the whole frame; the agent writes answers only for the app's
// own screens and adds them after these:
//
//   import { previewHandlers } from "nex-app-kit/preview";
//   export const handlers = [...previewHandlers({ manifest }), ...appHandlers];
//
// The routes come from STANDARD_ENDPOINTS (the same table KONTRAKT.md is checked against); the type below makes a
// route without an answer a build error. Only what the app has is answered — no own-password routes for an app
// launched from NEX Manager, no agents without AI. The answers are examples, marked as such where a person reads them.
import { HttpResponse, http, type HttpHandler } from "msw";
import type { ReleaseNote, SystemSettingRead, UserRead } from "nex-shared";

import kitSettings from "../server/src/nex_app_kit/kit_settings.json";
import serverEn from "../server/src/nex_app_kit/locales/en.json";
import serverHu from "../server/src/nex_app_kit/locales/hu.json";
import serverSk from "../server/src/nex_app_kit/locales/sk.json";
import type { AppManifest } from "./manifest";
import {
  STANDARD_ENDPOINTS,
  type AgentSettingRead,
  type CurrentUser,
  type EndpointId,
  type SessionRead,
  type UserLayout,
} from "./standard-api";

export interface PreviewOptions {
  manifest: AppManifest;
  /** Who is signed in; an admin with nothing due unless the app says otherwise. */
  user?: Partial<CurrentUser>;
  /** The app's own sample people for Nastavenia → Používatelia — the same ones its own screens show, so the two never
   *  disagree in the preview (DEV-292). The signed-in person is always among them: the entry with the same ``id`` is
   *  the signed-in one, and when none has it, the signed-in person comes first. Missing fields are filled. Without it,
   *  the list is the signed-in person and one sample colleague. */
  users?: Array<Partial<UserRead> & Pick<UserRead, "id" | "username">>;
  /** The app's own system settings, as its server would list them. */
  settings?: SystemSettingRead[];
  releaseNotes?: ReleaseNote[];
  /** Ako začať — Markdown. */
  gettingStarted?: string;
}

const NOW = "2026-01-01T08:00:00Z";

/** The kit's own settings, as the server lists them — from the same file the server reads. */
const KIT_SETTINGS: SystemSettingRead[] = kitSettings.map((d) => ({
  key: d.key,
  value: d.default,
  value_type: d.value_type as SystemSettingRead["value_type"],
  label: d.label,
  description: d.description,
  unit: d.unit,
  updated_at: null,
  updated_by: null,
  updated_by_username: null,
  is_default: true,
}));

/**
 * DEV-421 — the server's own catalogs, the same files it says the template's settings from. The template's settings
 * carry keys since 0.14.0 (DEV-394) and the server says them in the person's language; the preview has no server, and
 * until 0.16.2 it passed the keys on — „kit.setting.idle.label“ on Nastavenia → Systém in every language (NEX Manager
 * 1.7.0, 17.11.2026).
 */
export const SERVER_CATALOGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  sk: serverSk,
  hu: serverHu,
  en: serverEn,
};

/** A word of a setting as the server says it (``i18n.tr``): in the person's language, else the app's main one, else
 *  Slovak, else as it stands — an app's own words are no keys and stay as they are. */
function saidAs<T extends string | null | undefined>(text: T, language: string | null | undefined, main: string): T {
  if (!text) return text;
  for (const code of [language, main, "sk"]) {
    const said = code ? SERVER_CATALOGS[code]?.[text] : undefined;
    if (said) return said as T;
  }
  return text;
}

type Answer = (args: { params: Record<string, string | readonly string[] | undefined>; body: unknown }) => Response;

function json(data: unknown, status = 200): Response {
  return HttpResponse.json(data as never, { status });
}

function noContent(): Response {
  return new HttpResponse(null, { status: 204 });
}

export function previewHandlers(options: PreviewOptions): HttpHandler[] {
  const { manifest } = options;
  let me: CurrentUser = {
    id: "nahlad-spravca",
    username: "spravca",
    email: "spravca@priklad.sk",
    role: "admin",
    is_active: true,
    first_name: "Ukážkový",
    last_name: "správca",
    created_at: NOW,
    updated_at: NOW,
    ...options.user,
    must_change_password: false,
  };
  const colleague: UserRead = {
    id: "nahlad-pouzivatel",
    username: "pouzivatel",
    email: "pouzivatel@priklad.sk",
    role: "user",
    is_active: true,
    first_name: "Ukážkový",
    last_name: "používateľ",
    created_at: NOW,
    updated_at: NOW,
  };
  const person = (u: Partial<UserRead> & Pick<UserRead, "id" | "username">): UserRead => ({
    email: `${u.username}@priklad.sk`,
    role: "user",
    is_active: true,
    first_name: null,
    last_name: null,
    created_at: NOW,
    ...u,
    updated_at: u.updated_at ?? u.created_at ?? NOW,
  });
  const listed = options.users?.map((u) => (u.id === me.id ? me : person(u)));
  const people: UserRead[] = !listed ? [me, colleague] : listed.some((u) => u.id === me.id) ? listed : [me, ...listed];
  const session: SessionRead = {
    id: "nahlad-relacia",
    user_id: me.id,
    username: me.username,
    created_at: NOW,
    last_seen_at: NOW,
    updated_at: NOW,
    expires_at: "2026-01-02T08:00:00Z",
    user_agent: "Náhľad Vizuálu",
    current: true,
  };
  const settings = [...KIT_SETTINGS, ...(options.settings ?? [])];
  // DEV-421: a setting as the server lists it — its words in the language of the person signed in to the preview.
  const main = manifest.languages?.[0] ?? "sk";
  const saidIn = (row: SystemSettingRead): SystemSettingRead => ({
    ...row,
    label: saidAs(row.label, me.language, main),
    description: saidAs(row.description, me.language, main),
    unit: saidAs(row.unit, me.language, main),
    choices: row.choices ? row.choices.map((c) => ({ ...c, label: saidAs(c.label, me.language, main) })) : row.choices,
  });
  const roles = manifest.ai ? manifest.ai.roles : [];
  let layout: UserLayout = {
    sidebar_width: null,
    sidebar_collapsed: false,
    limits: { sidebar_width: { min: 180, max: 360, default: 224 } },
  };
  const agents: Record<string, AgentSettingRead> = Object.fromEntries(
    roles.map((r) => [r.id, { role: r.id, model: "", effort: "" }]),
  );

  const answers: Record<EndpointId, Answer | null> = {
    // The browser comes to these from NEX Manager — never inside the preview.
    launch: null,
    launchPost: null,
    login: () => json(me),
    logout: () => noContent(),
    health: () => json({ status: "ok", version: "náhľad", checks: { database: "ok" } }),
    me: () => json(me),
    updateMe: ({ body }) => json({ ...me, ...(body as object) }),
    changePassword: () => noContent(),
    // DEV-394: the preview takes the choice, so the Manažér sees the app in each of its languages.
    setLanguage: ({ body }) => {
      me = { ...me, language: (body as { language?: string }).language ?? null };
      return json(me);
    },
    listUsers: () => json(people),
    createUser: ({ body }) => json({ ...colleague, ...(body as object), id: "nahlad-novy" }, 201),
    updateUser: ({ params, body }) =>
      json({ ...(people.find((u) => u.id === params.id) ?? colleague), ...(body as object), id: String(params.id) }),
    deleteUser: () => noContent(),
    setUserPassword: () => noContent(),
    listSessions: () => json([session]),
    revokeSession: () => noContent(),
    listSystemSettings: () => json(settings.map(saidIn)),
    updateSystemSetting: ({ params, body }) => {
      const row = settings.find((s) => s.key === params.key) ?? settings[0];
      return json({ ...(row && saidIn(row)), value: (body as { value: string }).value, is_default: false, updated_at: NOW, updated_by_username: me.username });
    },
    listAgentSettings: () => json(roles.map((r) => agents[r.id])),
    listAgentModels: () =>
      json([
        { id: "opus", label: "Opus" },
        { id: "sonnet", label: "Sonnet" },
        { id: "haiku", label: "Haiku" },
      ]),
    saveAgentSetting: ({ params, body }) => {
      const row = { role: String(params.role), ...(body as { model: string; effort: string }) };
      agents[row.role] = row;
      return json(row);
    },
    getLayout: () => json(layout),
    saveLayout: ({ body }) => {
      layout = { ...layout, ...(body as Partial<UserLayout>) };
      return json(layout);
    },
    releaseNotes: () =>
      json(
        options.releaseNotes ?? [
          { version: "v0.1.0", released_at: null, markdown: "Ukážka — poznámky k vydaniu napíše agent do docs/specs/versions." },
        ],
      ),
    gettingStarted: () =>
      json({ markdown: options.gettingStarted ?? "Ukážka — návod pre človeka, ktorý aplikáciu ešte nevidel, napíše agent do docs/AKO_ZACAT.md." }),
    // DEV-377: the preview serves no customer — it looks as an app outside the cockpit.
    installation: () => json({ customer: null, environment: null }),
    installationManifest: () => json({ name: manifest.name, short_name: manifest.name, start_url: "/", display: "standalone" }),
  };

  const allowed = new Set(["always", manifest.auth === "password" ? "password" : "manager", ...(manifest.ai ? ["ai"] : [])]);
  return STANDARD_ENDPOINTS.filter((e) => allowed.has(e.scope)).flatMap((e) => {
    const answer = answers[e.id];
    if (!answer) return [];
    // Any address: the preview runs on the sandbox's own, a test on another — what counts is /api/v1.
    const path = `*/api/v1${e.path.replace(/\{(\w+)\}/g, ":$1")}`;
    const method = e.method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete";
    return [
      http[method](path, async ({ request, params }) => {
        const text = request.method === "GET" || request.method === "DELETE" ? "" : await request.text();
        return answer({ params, body: text ? JSON.parse(text) : undefined });
      }),
    ];
  });
}
