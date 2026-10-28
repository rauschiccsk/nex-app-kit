import {
  STANDARD_ENDPOINTS
} from "./chunk-LLPF2X56.js";

// src/preview.ts
import { HttpResponse, http } from "msw";

// server/src/nex_app_kit/kit_settings.json
var kit_settings_default = [
  {
    key: "auth_session_idle_minutes",
    default: "480",
    value_type: "int",
    label: "Odhl\xE1senie po ne\u010Dinnosti",
    description: "Po ko\u013Ek\xFDch min\xFAtach bez pr\xE1ce aplik\xE1cia \u010Dloveka odhl\xE1si.",
    unit: "min\xFAt",
    min: 5,
    max: 1440
  },
  {
    key: "auth_session_max_hours",
    default: "24",
    value_type: "int",
    label: "Najdlh\u0161ie prihl\xE1senie",
    description: "Najnesk\xF4r po ko\u013Ek\xFDch hodin\xE1ch sa treba prihl\xE1si\u0165 znova, aj ke\u010F \u010Dlovek pracuje.",
    unit: "hod\xEDn",
    min: 1,
    max: 720
  }
];

// src/preview.ts
var NOW = "2026-01-01T08:00:00Z";
var KIT_SETTINGS = kit_settings_default.map((d) => ({
  key: d.key,
  value: d.default,
  value_type: d.value_type,
  label: d.label,
  description: d.description,
  unit: d.unit,
  updated_at: null,
  updated_by: null,
  updated_by_username: null,
  is_default: true
}));
function json(data, status = 200) {
  return HttpResponse.json(data, { status });
}
function noContent() {
  return new HttpResponse(null, { status: 204 });
}
function previewHandlers(options) {
  const { manifest } = options;
  const me = {
    id: "nahlad-spravca",
    username: "spravca",
    email: "spravca@priklad.sk",
    role: "admin",
    is_active: true,
    first_name: "Uk\xE1\u017Ekov\xFD",
    last_name: "spr\xE1vca",
    created_at: NOW,
    updated_at: NOW,
    ...options.user,
    must_change_password: false
  };
  const colleague = {
    id: "nahlad-pouzivatel",
    username: "pouzivatel",
    email: "pouzivatel@priklad.sk",
    role: "user",
    is_active: true,
    first_name: "Uk\xE1\u017Ekov\xFD",
    last_name: "pou\u017E\xEDvate\u013E",
    created_at: NOW,
    updated_at: NOW
  };
  const session = {
    id: "nahlad-relacia",
    user_id: me.id,
    username: me.username,
    created_at: NOW,
    last_seen_at: NOW,
    updated_at: NOW,
    expires_at: "2026-01-02T08:00:00Z",
    user_agent: "N\xE1h\u013Ead Vizu\xE1lu",
    current: true
  };
  const settings = [...KIT_SETTINGS, ...options.settings ?? []];
  const roles = manifest.ai ? manifest.ai.roles : [];
  let layout = {
    sidebar_width: null,
    sidebar_collapsed: false,
    limits: { sidebar_width: { min: 180, max: 360, default: 224 } }
  };
  const agents = Object.fromEntries(
    roles.map((r) => [r.id, { role: r.id, model: "", effort: "" }])
  );
  const answers = {
    // The browser comes to these from NEX Manager — never inside the preview.
    launch: null,
    launchPost: null,
    login: () => json(me),
    logout: () => noContent(),
    health: () => json({ status: "ok", version: "n\xE1h\u013Ead", checks: { database: "ok" } }),
    me: () => json(me),
    updateMe: ({ body }) => json({ ...me, ...body }),
    changePassword: () => noContent(),
    listUsers: () => json([me, colleague]),
    createUser: ({ body }) => json({ ...colleague, ...body, id: "nahlad-novy" }, 201),
    updateUser: ({ params, body }) => json({ ...colleague, ...body, id: String(params.id) }),
    deleteUser: () => noContent(),
    setUserPassword: () => noContent(),
    listSessions: () => json([session]),
    revokeSession: () => noContent(),
    listSystemSettings: () => json(settings),
    updateSystemSetting: ({ params, body }) => {
      const row = settings.find((s) => s.key === params.key) ?? settings[0];
      return json({ ...row, value: body.value, is_default: false, updated_at: NOW, updated_by_username: me.username });
    },
    listAgentSettings: () => json(roles.map((r) => agents[r.id])),
    listAgentModels: () => json([
      { id: "opus", label: "Opus" },
      { id: "sonnet", label: "Sonnet" },
      { id: "haiku", label: "Haiku" }
    ]),
    saveAgentSetting: ({ params, body }) => {
      const row = { role: String(params.role), ...body };
      agents[row.role] = row;
      return json(row);
    },
    getLayout: () => json(layout),
    saveLayout: ({ body }) => {
      layout = { ...layout, ...body };
      return json(layout);
    },
    releaseNotes: () => json(
      options.releaseNotes ?? [
        { version: "v0.1.0", released_at: null, markdown: "Uk\xE1\u017Eka \u2014 pozn\xE1mky k vydaniu nap\xED\u0161e agent do docs/specs/versions." }
      ]
    ),
    gettingStarted: () => json({ markdown: options.gettingStarted ?? "Uk\xE1\u017Eka \u2014 n\xE1vod pre \u010Dloveka, ktor\xFD aplik\xE1ciu e\u0161te nevidel, nap\xED\u0161e agent do docs/AKO_ZACAT.md." })
  };
  const allowed = /* @__PURE__ */ new Set(["always", manifest.auth === "password" ? "password" : "manager", ...manifest.ai ? ["ai"] : []]);
  return STANDARD_ENDPOINTS.filter((e) => allowed.has(e.scope)).flatMap((e) => {
    const answer = answers[e.id];
    if (!answer) return [];
    const path = `*/api/v1${e.path.replace(/\{(\w+)\}/g, ":$1")}`;
    const method = e.method.toLowerCase();
    return [
      http[method](path, async ({ request, params }) => {
        const text = request.method === "GET" || request.method === "DELETE" ? "" : await request.text();
        return answer({ params, body: text ? JSON.parse(text) : void 0 });
      })
    ];
  });
}
export {
  previewHandlers
};
