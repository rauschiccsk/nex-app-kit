// @vitest-environment node
// DEV-251 — the standard server interface the template's frame uses, in one place: every call goes to the path and
// method the contract (KONTRAKT.md) names, and the contract names every path the kit calls.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ApiClient } from "nex-shared";

import { STANDARD_ENDPOINTS, createStandardApi } from "../src/standard-api";

function recordingClient() {
  const calls: string[] = [];
  const answer = (method: string) => async (path: string, body?: unknown) => {
    calls.push(`${method} ${path}${body === undefined ? "" : ` ${JSON.stringify(body)}`}`);
    return (method === "GET" && path === "/release-notes" ? [] : {}) as never;
  };
  const client = {
    get: answer("GET"),
    post: answer("POST"),
    put: answer("PUT"),
    patch: answer("PATCH"),
    delete: answer("DELETE"),
    request: async () => ({}) as never,
  } as unknown as ApiClient;
  return { client, calls };
}

describe("createStandardApi", () => {
  it("calls the contract's paths", async () => {
    const { client, calls } = recordingClient();
    const api = createStandardApi(client);

    await api.login("jan", "heslo-123");
    await api.logout();
    await api.health();
    await api.me();
    await api.updateMe({ email: "a@b.sk", first_name: "Ján", last_name: "Novák" });
    await api.changePassword("stare", "nove123");
    await api.listUsers();
    await api.createUser({ username: "jan", email: "a@b.sk", password: "heslo1", role: "user", first_name: "", last_name: "", is_active: true });
    await api.updateUser("u1", { email: "c@d.sk", role: "admin", first_name: "Ján", last_name: "", is_active: false });
    await api.deleteUser("u1");
    await api.setUserPassword("u1", "nove123");
    await api.listSessions();
    await api.revokeSession("s1");
    await api.listSystemSettings();
    await api.updateSystemSetting("search_limit", "20");
    await api.listAgentSettings();
    await api.listAgentModels();
    await api.saveAgentSetting("assistant", { model: "sonnet", effort: "high" });
    await api.getLayout();
    await api.saveLayout({ sidebar_width: 260 });
    await api.releaseNotes();
    await api.gettingStarted();

    expect(calls).toEqual([
      'POST /auth/login {"username":"jan","password":"heslo-123"}',
      "POST /auth/logout",
      "GET /health",
      "GET /auth/me",
      'PATCH /auth/me {"email":"a@b.sk","first_name":"Ján","last_name":"Novák"}',
      'POST /auth/change-password {"current_password":"stare","new_password":"nove123"}',
      "GET /users",
      'POST /users {"username":"jan","email":"a@b.sk","password":"heslo1","role":"user","first_name":"","last_name":"","is_active":true}',
      'PATCH /users/u1 {"email":"c@d.sk","role":"admin","first_name":"Ján","last_name":"","is_active":false}',
      "DELETE /users/u1",
      'POST /users/u1/password {"new_password":"nove123"}',
      "GET /sessions",
      "DELETE /sessions/s1",
      "GET /system-settings",
      'PATCH /system-settings/search_limit {"value":"20"}',
      "GET /agent-settings",
      "GET /agent-settings/models",
      'PUT /agent-settings/assistant {"model":"sonnet","effort":"high"}',
      "GET /user-layout",
      'PUT /user-layout {"sidebar_width":260}',
      "GET /release-notes",
      "GET /getting-started",
    ]);
  });

  it("puts a path segment into the URL encoded", async () => {
    const { client, calls } = recordingClient();
    await createStandardApi(client).updateSystemSetting("a/b c", "1");

    expect(calls).toEqual(['PATCH /system-settings/a%2Fb%20c {"value":"1"}']);
  });

  it("the contract document names every endpoint the kit calls, and nothing else", () => {
    const doc = readFileSync(new URL("../KONTRAKT.md", import.meta.url), "utf8");
    const documented = [...doc.matchAll(/^\| `(GET|POST|PUT|PATCH|DELETE) (\/[^`]*)` \|/gm)].map((m) => `${m[1]} ${m[2]}`);

    expect(documented.sort()).toEqual(STANDARD_ENDPOINTS.map((e) => `${e.method} ${e.path}`).sort());
  });
});
