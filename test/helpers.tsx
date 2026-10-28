// A fake server for the frame's tests: answers the standard interface (KONTRAKT.md) from a table and records every
// call, so a test can say both what the screen shows and what the frame asked the server.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import type { ApiClient } from "nex-shared";

import { defineApp, type AppManifestInput } from "../src/manifest";
import type { CurrentUser, UserLayout } from "../src/standard-api";
import { TemplateApp } from "../src/TemplateApp";

export interface Call {
  method: string;
  path: string;
  body?: unknown;
}

type Answer = unknown | ((body: unknown) => unknown);

export const LAYOUT: UserLayout = {
  sidebar_width: null,
  sidebar_collapsed: false,
  limits: { sidebar_width: { min: 180, max: 360, default: 224 } },
};

export const ADMIN: CurrentUser = {
  id: "u1",
  username: "jan",
  email: "jan@firma.sk",
  role: "admin",
  is_active: true,
  first_name: "Ján",
  last_name: "Novák",
  created_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
};

export const PLAIN_USER: CurrentUser = { ...ADMIN, id: "u2", username: "eva", role: "user", first_name: "Eva", last_name: "Malá" };

const DEFAULTS: Record<string, Answer> = {
  "GET /health": { status: "ok", version: "0.1.0" },
  "GET /user-layout": LAYOUT,
  "PUT /user-layout": (body: unknown) => ({ ...LAYOUT, ...(body as object) }),
  "GET /release-notes": [],
  "GET /getting-started": { markdown: "" },
  "GET /system-settings": [],
  "GET /sessions": [],
  "GET /users": [],
  "GET /agent-settings": [],
  "GET /agent-settings/models": [],
};

export function fakeClient(answers: Record<string, Answer> = {}) {
  const calls: Call[] = [];
  const table = { ...DEFAULTS, ...answers };
  const handle = (method: string) => async (path: string, body?: unknown) => {
    const sent = method === "GET" || method === "DELETE" ? undefined : body;
    calls.push(sent === undefined ? { method, path } : { method, path, body: sent });
    const key = `${method} ${path}`;
    if (!(key in table)) return {} as never;
    const answer = table[key];
    if (answer instanceof Error) throw answer;
    return (typeof answer === "function" ? (answer as (b: unknown) => unknown)(sent) : answer) as never;
  };
  const client = {
    get: handle("GET"),
    post: handle("POST"),
    put: handle("PUT"),
    patch: handle("PATCH"),
    delete: handle("DELETE"),
    request: async () => ({}) as never,
  } as unknown as ApiClient;
  return { client, calls };
}

export const BASE: AppManifestInput = { template: "nsv-standard", name: "NEX Knowledge", initials: "NK", auth: "password" };

export interface RenderOptions {
  manifest?: Partial<AppManifestInput>;
  user?: CurrentUser | null;
  path?: string;
  answers?: Record<string, Answer>;
  onLogout?: () => void;
  routes?: ReactNode;
  frontendVersion?: string;
}

export function renderApp(options: RenderOptions = {}) {
  const { client, calls } = fakeClient(options.answers);
  const manifest = defineApp({ ...BASE, ...options.manifest });
  const utils = render(
    <MemoryRouter initialEntries={[options.path ?? "/"]}>
      <TemplateApp
        manifest={manifest}
        client={client}
        user={options.user === undefined ? ADMIN : options.user}
        onLogout={options.onLogout}
        frontendVersion={options.frontendVersion}
        overview={<p>Obsah prehľadu</p>}
      >
        {options.routes}
      </TemplateApp>
    </MemoryRouter>,
  );
  return { ...utils, calls };
}

/** The left panel top to bottom: each entry's name (with its count), „—“ for the line. */
export function panelEntries(): string[] {
  const nav = document.querySelector("aside nav");
  if (!nav) throw new Error("no left panel");
  return [...nav.children].map((el) => {
    if (el.tagName === "HR") return "—";
    const icon = el.querySelector('[aria-hidden="true"]')?.textContent ?? "";
    return (el.textContent ?? "").replace(icon, "").trim();
  });
}
