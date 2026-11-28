// src/standard-api.ts
var STANDARD_ROLES = [
  // DEV-394: the label is a key of the template's catalogs — shown in the person's language.
  { value: "admin", label: "kit.role.admin" },
  { value: "user", label: "kit.role.user" }
];
var ADMIN_ROLE = "admin";
var PASSWORD_MIN_LENGTH = 1;
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
  // DEV-394: the person's language — kept with the person; launched from NEX Manager, the Manager says it.
  { id: "setLanguage", method: "PUT", path: "/auth/language", scope: "password" },
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
  { id: "gettingStarted", method: "GET", path: "/getting-started", scope: "always" },
  // DEV-377: whom the installation serves — and its installed-app description, which the browser reads by the link in
  // the page's head (the frame points the link there and never calls it itself).
  { id: "installation", method: "GET", path: "/installation", scope: "always" },
  { id: "installationManifest", method: "GET", path: "/installation/manifest.webmanifest", scope: "always" },
  // DEV-523: the web (web/) — its own accounts signed in by e-mail, a registration request the admin decides.
  { id: "webRegister", method: "POST", path: "/web/auth/register", scope: "web" },
  { id: "webLogin", method: "POST", path: "/web/auth/login", scope: "web" },
  { id: "webMe", method: "GET", path: "/web/auth/me", scope: "web" },
  { id: "webLogout", method: "POST", path: "/web/auth/logout", scope: "web" },
  { id: "listWebAccounts", method: "GET", path: "/web-accounts", scope: "web" },
  { id: "approveWebAccount", method: "POST", path: "/web-accounts/{id}/approve", scope: "web" },
  { id: "rejectWebAccount", method: "POST", path: "/web-accounts/{id}/reject", scope: "web" },
  { id: "disableWebAccount", method: "POST", path: "/web-accounts/{id}/disable", scope: "web" },
  { id: "enableWebAccount", method: "POST", path: "/web-accounts/{id}/enable", scope: "web" },
  // DEV-535 — Sprievodca.
  { id: "guidePlan", method: "POST", path: "/guide/plan", scope: "guide" },
  { id: "guideProgress", method: "POST", path: "/guide/sessions/{id}/progress", scope: "guide" },
  { id: "guideRate", method: "POST", path: "/guide/sessions/{id}/rating", scope: "guide" },
  { id: "guideEvent", method: "POST", path: "/guide/events", scope: "guide" },
  { id: "guideFeedback", method: "GET", path: "/guide/feedback", scope: "guide" }
];
var WEB_ACTION_ENDPOINT = {
  approve: "approveWebAccount",
  reject: "rejectWebAccount",
  disable: "disableWebAccount",
  enable: "enableWebAccount"
};
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
    installation: () => call("installation"),
    me: () => call("me"),
    updateMe: (changes) => call("updateMe", {}, changes),
    setLanguage: (language) => call("setLanguage", {}, { language }),
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
    gettingStarted: () => call("gettingStarted"),
    webRegister: (registration) => call("webRegister", {}, registration),
    webLogin: (email, password) => call("webLogin", {}, { email, password }),
    webMe: () => call("webMe"),
    webLogout: () => call("webLogout"),
    listWebAccounts: () => call("listWebAccounts"),
    decideWebAccount: (id, action) => call(WEB_ACTION_ENDPOINT[action], { id }),
    guidePlan: (body) => call("guidePlan", {}, body),
    guideProgress: (id, status, currentStep, reason) => call("guideProgress", { id }, { status, current_step: currentStep, ...reason ? { reason } : {} }),
    guideRate: (id, rating, comment) => call("guideRate", { id }, { rating, ...comment ? { comment } : {} }),
    guideEvent: (event) => call("guideEvent", {}, event),
    guideFeedback: () => call("guideFeedback")
  };
}

export {
  STANDARD_ROLES,
  ADMIN_ROLE,
  PASSWORD_MIN_LENGTH,
  STANDARD_ENDPOINTS,
  createStandardApi
};
