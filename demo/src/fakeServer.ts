// A server held in memory that answers the standard interface (KONTRAKT.md) — enough for every screen of the frame.
import type { ApiClient } from "nex-shared";

const now = "2026-10-28T19:00:00Z";
const person = (id: string, username: string, role: string, first: string, last: string, active = true) => ({
  id,
  username,
  email: `${username}@firma.sk`,
  role,
  is_active: active,
  first_name: first,
  last_name: last,
  created_at: now,
  updated_at: now,
});

export const ME = person("u1", "jan", "admin", "Ján", "Novák");
const users = [ME, person("u2", "eva", "user", "Eva", "Malá"), person("u3", "peter", "user", "Peter", "", false)];
const sessions = [
  { id: "s1", user_id: "u1", token_version: 1, last_seen_at: now, created_at: now, updated_at: now },
  { id: "s2", user_id: "u2", token_version: 3, last_seen_at: "2026-10-28T08:12:00Z", created_at: now, updated_at: now },
];
const setting = (key: string, value: string, value_type: string, label: string, description: string, unit = "") => ({
  key,
  value,
  value_type,
  label,
  description,
  unit,
  updated_at: null,
  updated_by: null,
  updated_by_username: null,
  is_default: true,
});
const settings = [
  setting("search_limit", "20", "int", "Počet výsledkov", "Koľko výsledkov ukáže hľadanie na jednej stránke."),
  setting("search_min_score", "0.35", "float", "Najnižšia zhoda", "Výsledok s menšou zhodou sa neukáže."),
  setting("retention_days", "365", "int", "Doba uchovania", "Po tejto dobe sa záznam presunie do archívu.", "dní"),
];
let layout = { sidebar_width: null as number | null, sidebar_collapsed: false, limits: { sidebar_width: { min: 180, max: 360, default: 224 } } };
let agents = [{ role: "assistant", model: "sonnet", effort: "high" }];

const GUIDE = `## Čo aplikácia robí

NEX Ukážka ukazuje šablónu **NSV štandard** — ľavý panel, hornú lištu a Nastavenia tak, ako ich má kokpit.

## Prvé kroky

1. V ľavom paneli otvor **Oblasti** a pozri, čo v nich je.
2. V **Nastaveniach** si v záložke **Moje konto** skontroluj meno a e-mail.
3. Šírku ľavého panela zmeníš ťahaním za jeho pravý okraj — zapamätá sa pre teba.
`;

const NOTES = [
  { version: "0.2.0", released_at: "2026-10-28", markdown: "## v0.2.0\n\n### Nové\n- Hľadanie v oblastiach.\n- Počet oblastí v ľavom paneli." },
  { version: "0.1.0", released_at: "2026-10-20", markdown: "## v0.1.0\n\n### Nové\n- Prvá verzia: oblasti a ich zoznam." },
];

function answer(method: string, path: string, body: unknown): unknown {
  const key = `${method} ${path}`;
  const b = (body ?? {}) as Record<string, unknown>;
  if (key === "GET /health") return { status: "ok", version: "0.2.0", checks: { database: "ok" } };
  if (key === "GET /auth/me") return ME;
  if (key === "PATCH /auth/me") return Object.assign(ME, b);
  if (key === "POST /auth/change-password") return undefined;
  if (key === "GET /users") return users;
  if (key === "POST /users") {
    const u = person(`u${users.length + 1}`, String(b.username), String(b.role), String(b.first_name), String(b.last_name));
    users.push(u);
    return u;
  }
  const userMatch = path.match(/^\/users\/([^/]+)$/);
  if (userMatch && method === "PATCH") return Object.assign(users.find((u) => u.id === userMatch[1]) ?? {}, b);
  if (userMatch && method === "DELETE") return undefined;
  if (/^\/users\/[^/]+\/password$/.test(path)) return undefined;
  if (key === "GET /sessions") return sessions;
  if (method === "DELETE" && path.startsWith("/sessions/")) return undefined;
  if (key === "GET /system-settings") return settings;
  if (method === "PATCH" && path.startsWith("/system-settings/")) {
    const row = settings.find((s) => s.key === decodeURIComponent(path.split("/")[2] ?? ""));
    return Object.assign(row ?? {}, { value: b.value, is_default: false, updated_at: now, updated_by_username: "jan" });
  }
  if (key === "GET /agent-settings") return agents;
  if (key === "GET /agent-settings/models") return [{ id: "opus", label: "Opus" }, { id: "sonnet", label: "Sonnet" }, { id: "haiku", label: "Haiku" }];
  if (method === "PUT" && path.startsWith("/agent-settings/")) {
    const role = path.split("/")[2] ?? "";
    agents = [...agents.filter((a) => a.role !== role), { role, model: String(b.model), effort: String(b.effort) }];
    return agents.find((a) => a.role === role);
  }
  if (key === "GET /user-layout") return layout;
  if (key === "PUT /user-layout") return (layout = { ...layout, ...b });
  if (key === "GET /release-notes") return NOTES;
  if (key === "GET /getting-started") return { markdown: GUIDE };
  throw new Error(`Ukážkový server nepozná ${key}.`);
}

const handle = (method: string) => async (path: string, body?: unknown) =>
  answer(method, path, method === "GET" || method === "DELETE" ? undefined : body) as never;

export const demoClient = {
  get: handle("GET"),
  post: handle("POST"),
  put: handle("PUT"),
  patch: handle("PATCH"),
  delete: handle("DELETE"),
  request: async () => ({}) as never,
} as unknown as ApiClient;

export function useAreaCount() {
  return 3;
}
