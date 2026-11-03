// @vitest-environment node
// DEV-253 — the Vizuál preview runs without a server: the kit answers the frame's own routes (nex-app-kit/preview), so
// the frame opens signed in and the agent writes answers only for the app's own screens. Every route the frame calls
// has its answer — the list comes from STANDARD_ENDPOINTS, not from memory.
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApiClient } from "nex-shared";

import { defineApp } from "../src/manifest";
import { previewHandlers } from "../src/preview";
import { STANDARD_ENDPOINTS, createStandardApi } from "../src/standard-api";

const APP = defineApp({
  template: "nsv-standard",
  name: "NEX Skúška",
  initials: "NS",
  auth: "password",
  ai: { roles: [{ id: "assistant", label: "Asistent" }] },
  settings: { categories: [{ id: "search", label: "Hľadanie", description: "", prefixes: ["search_"] }] },
});
const server = setupServer();
const api = createStandardApi(createApiClient({ baseUrl: "http://nahlad.local", apiPrefix: "/api/v1", getToken: () => null }));

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("preview answers", () => {
  it("every route the frame calls in this app has an answer", async () => {
    server.use(...previewHandlers({ manifest: APP }));

    await api.me();
    await api.login("spravca", "heslo");
    await api.updateMe({ email: "a@b.sk", first_name: "A", last_name: "B" });
    await api.changePassword("a", "bbbbbbbb");
    await api.listUsers();
    await api.createUser({ username: "eva", email: "e@b.sk", password: "heslo-123", role: "user", first_name: "", last_name: "", is_active: true });
    await api.updateUser("u2", { email: "e@b.sk", role: "user", first_name: "", last_name: "", is_active: false });
    await api.deleteUser("u2");
    await api.setUserPassword("u2", "heslo-123");
    await api.listSessions();
    await api.revokeSession("s1");
    await api.listSystemSettings();
    await api.updateSystemSetting("auth_session_idle_minutes", "60");
    await api.listAgentSettings();
    await api.listAgentModels();
    await api.saveAgentSetting("assistant", { model: "opus", effort: "high" });
    await api.getLayout();
    await api.saveLayout({ sidebar_width: 260 });
    await api.releaseNotes();
    await api.gettingStarted();
    await api.health();
    await api.logout();
  });

  it("the preview covers every endpoint of the table but the launch from NEX Manager", () => {
    const covered = previewHandlers({ manifest: { ...APP, ai: APP.ai } }).map((h) => `${h.info.method} ${h.info.path}`);
    const wanted = STANDARD_ENDPOINTS.filter((e) => e.scope !== "manager").map(
      (e) => `${e.method} */api/v1${e.path.replace(/\{(\w+)\}/g, ":$1")}`,
    );

    expect(new Set(covered)).toEqual(new Set(wanted));
  });

  it("the signed-in person is an admin with nothing due, so the whole frame shows", async () => {
    server.use(...previewHandlers({ manifest: APP }));

    const me = await api.me();

    expect({ role: me.role, must_change_password: me.must_change_password, is_active: me.is_active }).toEqual({
      role: "admin",
      must_change_password: false,
      is_active: true,
    });
  });

  it("the layout the person sets stays for the session of the preview", async () => {
    server.use(...previewHandlers({ manifest: APP }));

    await api.saveLayout({ sidebar_collapsed: true });

    expect((await api.getLayout()).sidebar_collapsed).toBe(true);
  });

  it("the app's own settings, release notes and guide are shown as the app gives them", async () => {
    server.use(
      ...previewHandlers({
        manifest: APP,
        settings: [{ key: "search_limit", value: "20", value_type: "int", label: "Počet výsledkov", description: "", unit: null, updated_at: null, updated_by: null, updated_by_username: null, is_default: true }],
        releaseNotes: [{ version: "v0.1.0", released_at: null, markdown: "Prvá verzia." }],
        gettingStarted: "## Prvé kroky",
      }),
    );

    expect((await api.listSystemSettings()).map((s) => s.key)).toEqual([
      "auth_session_idle_minutes",
      "auth_session_max_hours",
      "search_limit",
    ]);
    expect(await api.releaseNotes()).toEqual([{ version: "v0.1.0", released_at: null, markdown: "Prvá verzia." }]);
    expect((await api.gettingStarted()).markdown).toBe("## Prvé kroky");
  });

  // DEV-292 — NEX Manager 1.5.0's preview showed two people in Nastavenia → Používatelia and eight in its own „Ľudia
  // a prístupy": the template had its two sample people built in and the app could not give it its own.
  const ZUZANA = { id: "u-1", username: "admin", role: "admin", first_name: "Zuzana", last_name: "Nováková" };
  const JANA = { id: "u-2", username: "kovacova", first_name: "Jana", last_name: "Kováčová" };
  const PETER = { id: "u-3", username: "hudak", is_active: false, created_at: "2026-06-21T08:00:00Z" };

  it("Nastavenia → Používatelia shows the app's own sample people, the signed-in one as the frame knows them", async () => {
    server.use(...previewHandlers({ manifest: APP, user: { ...ZUZANA, email: "zuzana@firma.sk" }, users: [ZUZANA, JANA, PETER] }));

    const people = await api.listUsers();

    expect(people.map((u) => u.username)).toEqual(["admin", "kovacova", "hudak"]);
    expect(people[0]).toEqual(await api.me());
  });

  it("the signed-in person comes first when the app's list does not have them", async () => {
    server.use(...previewHandlers({ manifest: APP, users: [JANA, PETER] }));

    expect((await api.listUsers()).map((u) => u.username)).toEqual(["spravca", "kovacova", "hudak"]);
  });

  it("what the app leaves out of a person is filled", async () => {
    server.use(...previewHandlers({ manifest: APP, users: [JANA, PETER] }));

    const people = await api.listUsers();

    expect(people[1]).toEqual({
      id: "u-2",
      username: "kovacova",
      email: "kovacova@priklad.sk",
      role: "user",
      is_active: true,
      first_name: "Jana",
      last_name: "Kováčová",
      created_at: "2026-01-01T08:00:00Z",
      updated_at: "2026-01-01T08:00:00Z",
    });
    expect([people[2]?.is_active, people[2]?.updated_at]).toEqual([false, "2026-06-21T08:00:00Z"]);
  });

  it("an edited person keeps what the edit does not change", async () => {
    server.use(...previewHandlers({ manifest: APP, users: [JANA] }));

    const edited = await api.updateUser("u-2", { email: "jana@firma.sk", role: "user", first_name: "Jana", last_name: "Nová", is_active: true });

    expect([edited.username, edited.last_name, edited.created_at]).toEqual(["kovacova", "Nová", "2026-01-01T08:00:00Z"]);
  });

  it("without the app's people the list is the signed-in person and one colleague", async () => {
    server.use(...previewHandlers({ manifest: APP }));

    expect((await api.listUsers()).map((u) => u.username)).toEqual(["spravca", "pouzivatel"]);
  });

  it("agents follow the manifest's roles", async () => {
    server.use(...previewHandlers({ manifest: APP }));

    expect((await api.listAgentSettings()).map((a) => a.role)).toEqual(["assistant"]);
  });

  it("an app launched from NEX Manager has no own password routes in the preview, an app without AI no agents", () => {
    const manager = defineApp({ template: "nsv-standard", name: "A", initials: "A", auth: "manager" });
    const paths = previewHandlers({ manifest: manager }).map((h) => `${h.info.method} ${h.info.path}`);

    expect(paths).not.toContain("POST */api/v1/auth/login");
    expect(paths).not.toContain("GET */api/v1/users");
    expect(paths).not.toContain("GET */api/v1/agent-settings");
    expect(paths).toContain("GET */api/v1/auth/me");
  });
});
