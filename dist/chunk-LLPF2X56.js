// src/standard-api.ts
var STANDARD_ROLES = [
  { value: "admin", label: "Spr\xE1vca" },
  { value: "user", label: "Pou\u017E\xEDvate\u013E" }
];
var ADMIN_ROLE = "admin";
var PASSWORD_MIN_LENGTH = 8;
var STANDARD_ENDPOINTS = [
  { id: "login", method: "POST", path: "/auth/login", scope: "password" },
  { id: "logout", method: "POST", path: "/auth/logout", scope: "always" },
  // The browser comes here from NEX Manager with the launch ticket — the frame never calls these.
  { id: "launch", method: "GET", path: "/launch", scope: "manager" },
  { id: "launchPost", method: "POST", path: "/launch", scope: "manager" },
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
  { id: "gettingStarted", method: "GET", path: "/getting-started", scope: "always" }
];
function createStandardApi(client) {
  function call(id, params = {}, body) {
    const endpoint = STANDARD_ENDPOINTS.find((e) => e.id === id);
    if (!endpoint) throw new Error(`Unknown standard endpoint: ${id}`);
    const path = endpoint.path.replace(/\{(\w+)\}/g, (_, name) => {
      const value = params[name];
      if (value === void 0) throw new Error(`Endpoint ${id} needs the path parameter ${name}`);
      return encodeURIComponent(value);
    });
    switch (endpoint.method) {
      case "GET":
        return client.get(path);
      case "DELETE":
        return client.delete(path);
      case "POST":
        return client.post(path, body);
      case "PUT":
        return client.put(path, body);
      case "PATCH":
        return client.patch(path, body);
    }
  }
  return {
    login: (username, password) => call("login", {}, { username, password }),
    logout: () => call("logout"),
    health: () => call("health"),
    me: () => call("me"),
    updateMe: (changes) => call("updateMe", {}, changes),
    changePassword: (currentPassword, newPassword) => call("changePassword", {}, { current_password: currentPassword, new_password: newPassword }),
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
    gettingStarted: () => call("gettingStarted")
  };
}

export {
  STANDARD_ROLES,
  ADMIN_ROLE,
  PASSWORD_MIN_LENGTH,
  STANDARD_ENDPOINTS,
  createStandardApi
};
