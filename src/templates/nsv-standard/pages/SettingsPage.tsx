// Nastavenia of „NSV štandard“, as in the cockpit (SettingsPage.tsx of nex-studio-visual): the panels of nex-shared,
// fed from the standard interface. Which tabs an app has follows its manifest (KONTRAKT.md → „kedy“, „Roly“):
//   Systém       — always; only an admin changes it
//   Agenti       — an app with AI; for the whole app, so for an admin only
//   Moje konto   — always; launched from NEX Manager it shows the account, which is changed in NEX Manager
//   Používatelia — an app with its own password; for an admin only
//   Relácie      — always; only an admin ends one
//   Kontá webu   — an app with a web (DEV-523); for an admin only: the requests to decide, accounts off and on
// Each tab loads its data when it is opened (SettingsShell mounts only the active tab).
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AgentsPanel,
  Card,
  MyAccountPanel,
  SessionsPanel,
  SettingsShell,
  SystemSettingsPanel,
  UsersPanel,
  type AgentDraft,
  type SettingsCategory,
  type SettingsKitConfig,
  type SettingsTabId,
  useLanguage,
  type SystemSettingRead,
  type UserFieldSchema,
  type UserRead,
} from "nex-shared";

import { useFrame } from "../../../frame/FrameContext";
import { errorText, personName, roleLabel } from "../../../frame/people";
import type { AppManifest } from "../../../manifest";
import {
  ADMIN_ROLE,
  PASSWORD_MIN_LENGTH,
  STANDARD_ROLES,
  type AgentModelOption,
  type SessionRead,
} from "../../../standard-api";
import { chooseLanguage, useKitT } from "../../../i18n";
import { useInstallationIdentity } from "../../../frame/installation";
import { WebAccountsTab } from "./WebAccountsTab";


/** The cockpit's effort levels — never `ultracode`, which is a setting, not a level. */
const EFFORTS = ["low", "medium", "high", "xhigh", "max"];


const USER_FIELDS: UserFieldSchema = { username: true, names: true, telegram: false, passwordMinLength: PASSWORD_MIN_LENGTH };

/** The kit's own settings (KONTRAKT.md → Prihlásenie a relácia), beside the app's categories. */
export const KIT_SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "kit-auth",
    // DEV-394: keys of the template's catalogs, said in the person's language where the panel draws them.
    label: "kit.settings.loginCategory",
    description: "kit.settings.loginCategoryHint",
    prefixes: ["auth_"],
  },
];

export function settingsConfig(manifest: AppManifest): SettingsKitConfig {
  const tabs: SettingsTabId[] = ["system"];
  if (manifest.ai) tabs.push("agents");
  tabs.push("konto");
  if (manifest.auth === "password") tabs.push("users");
  tabs.push("sessions");
  if (manifest.web) tabs.push("web");
  return {
    tabs,
    // DEV-394: the tabs are named by nex-shared, in the person's language.
    labels: {},
    tabVisibleForRole: (tab, role) => (tab === "users" || tab === "agents" || tab === "web" ? role === ADMIN_ROLE : true),
  };
}

function SystemTab() {
  const t = useKitT();
  const { api, manifest, isAdmin } = useFrame();
  const [settings, setSettings] = useState<SystemSettingRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .listSystemSettings()
      .then(setSettings)
      .catch((e: unknown) => setLoadError(errorText(e, t("kit.settings.loadFailed"))))
      .finally(() => setLoading(false));
  }, [api, t]);

  const save = useCallback(
    async (key: string, value: string) => {
      const row = await api.updateSystemSetting(key, value);
      setSettings((prev) => prev.map((s) => (s.key === key ? row : s)));
      return row;
    },
    [api],
  );

  return (
    <SystemSettingsPanel
      settings={settings}
      categories={[...manifest.settings.categories, ...KIT_SETTINGS_CATEGORIES].map((c) => ({
        ...c,
        label: t(c.label),
        description: c.description ? t(c.description) : c.description,
      }))}
      canEdit={isAdmin}
      onSave={save}
      loading={loading}
      loadError={loadError}
    />
  );
}

function AgentsTab() {
  const t = useKitT();
  const { api, manifest } = useFrame();
  const roles = (manifest.ai ? [...manifest.ai.roles] : []).map((r) => ({ ...r, label: t(r.label) }));
  const [models, setModels] = useState<AgentModelOption[]>([]);
  const [drafts, setDrafts] = useState<Record<string, AgentDraft> | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.listAgentSettings(), api.listAgentModels()])
      .then(([rows, options]) => {
        const initial: Record<string, AgentDraft> = {};
        for (const r of manifest.ai ? manifest.ai.roles : []) initial[r.id] = { model: "", effort: "" };
        for (const row of rows) initial[row.role] = { model: row.model ?? "", effort: row.effort ?? "" };
        setModels(options);
        setDrafts(initial);
      })
      .catch((e: unknown) => setLoadError(errorText(e, t("kit.settings.agentsLoadFailed"))));
  }, [api, manifest, t]);

  const save = useCallback(
    async (role: string, draft: AgentDraft) => {
      setSaveErrors((prev) => ({ ...prev, [role]: "" }));
      try {
        await api.saveAgentSetting(role, { model: draft.model, effort: draft.effort });
      } catch (e) {
        setSaveErrors((prev) => ({ ...prev, [role]: errorText(e, t("kit.settings.saveFailed")) }));
        throw e;
      }
    },
    [api, t],
  );

  return (
    <AgentsPanel
      roles={roles}
      models={models}
      efforts={EFFORTS}
      drafts={drafts ?? {}}
      onSave={save}
      loading={drafts === null && !loadError}
      loadError={loadError}
      saveErrors={saveErrors}
    />
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-xs text-[var(--color-text-muted)]">{label}</div>
      <div className="text-sm text-[var(--color-text-secondary)]">{value || "—"}</div>
    </div>
  );
}

function AccountTab() {
  const t = useKitT();
  const { language } = useLanguage();
  const { api, manifest, user, setUser } = useFrame();
  if (!user) return null;

  if (manifest.auth === "manager") {
    return (
      <div className="p-6">
        <Card className="max-w-3xl">
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("kit.settings.managedByManager")}</p>
          <div className="grid grid-cols-2 gap-3">
            <ReadOnlyField label={t("kit.settings.fullName")} value={personName(user)} />
            <ReadOnlyField label={t("kit.settings.email")} value={user.email} />
            <ReadOnlyField label={t("user.username")} value={user.username} />
            <ReadOnlyField label={t("user.role")} value={roleLabel(user.role, t)} />
          </div>
        </Card>
      </div>
    );
  }

  return (
    <MyAccountPanel
      user={{
        username: user.username,
        role: user.role,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      }}
      roleLabel={roleLabel(user.role, t)}
      telegram={false}
      // DEV-394: the person's language — offered when the app speaks more than one.
      languages={manifest.languages}
      language={language}
      onLanguageChange={async (next) => {
        setUser(await api.setLanguage(next));
      }}
      passwordMinLength={PASSWORD_MIN_LENGTH}
      onSaveProfile={async ({ email, first_name, last_name }) => {
        setUser(await api.updateMe({ email, first_name, last_name }));
      }}
      // DEV-439: the signed-in person changes their password without the current one; the eye shows what they type.
      askCurrentPassword={false}
      onChangePassword={(_current, next) => api.changePassword("", next)}
    />
  );
}

function UsersTab() {
  const t = useKitT();
  const { api, isAdmin, manifest, user } = useFrame();
  // DEV-415: each person's language — the language of whoever chose none is the installation's.
  const installation = useInstallationIdentity();
  const defaultLanguage = chooseLanguage(manifest.languages, null, installation?.language);
  const roleOptions = STANDARD_ROLES.map((r) => ({ value: r.value, label: t(r.label) }));
  const [users, setUsers] = useState<UserRead[]>([]);

  useEffect(() => {
    api
      .listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
  }, [api]);

  const replace = (row: UserRead) => setUsers((prev) => prev.map((u) => (u.id === row.id ? row : u)));

  return (
    <UsersPanel
      users={users}
      rowActions={manifest.userActions}
      roleOptions={roleOptions}
      canManage={isAdmin}
      // DEV-439: one's own row offers no delete or deactivation and its password has the eye; the app's admin is never
      // offered for deletion — only their details change (the server refuses it too).
      currentUserId={user?.id}
      mayDelete={(u) => u.role !== ADMIN_ROLE}
      fieldSchema={USER_FIELDS}
      languages={manifest.languages}
      defaultLanguage={defaultLanguage}
      onCreate={async (d) => {
        const row = await api.createUser({
          username: d.username,
          email: d.email,
          password: d.password,
          role: d.role,
          first_name: d.first_name,
          last_name: d.last_name,
          is_active: d.is_active,
          ...(d.language ? { language: d.language } : {}),
        });
        setUsers((prev) => [...prev, row]);
      }}
      onUpdate={async (id, d) => {
        replace(
          await api.updateUser(id, {
            email: d.email,
            role: d.role,
            first_name: d.first_name,
            last_name: d.last_name,
            is_active: d.is_active,
            ...(d.language ? { language: d.language } : {}),
          }),
        );
      }}
      onDelete={async (id) => {
        await api.deleteUser(id);
        setUsers((prev) => prev.filter((u) => u.id !== id));
      }}
      onChangePassword={(id, password) => api.setUserPassword(id, password)}
      onToggleActive={async (u) => {
        replace(
          await api.updateUser(u.id, {
            email: u.email,
            role: u.role,
            first_name: u.first_name ?? "",
            last_name: u.last_name ?? "",
            is_active: !u.is_active,
          }),
        );
      }}
      roleClass={(role) => (role === ADMIN_ROLE ? "text-[var(--color-accent-primary)]" : "")}
    />
  );
}

function SessionsTab() {
  const t = useKitT();
  const { api, isAdmin } = useFrame();
  const [sessions, setSessions] = useState<SessionRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    api
      .listSessions()
      .then(setSessions)
      .catch((e: unknown) => setLoadError(errorText(e, t("kit.settings.sessionsLoadFailed"))))
      .finally(() => setLoading(false));
  }, [api, t]);

  // Every row names its person — the server joins them, so nobody needs the users list to read this tab.
  const names = useMemo(() => Object.fromEntries(sessions.map((s) => [s.user_id, s.username ?? s.user_id])), [sessions]);

  return (
    <SessionsPanel
      sessions={sessions}
      resolveUsername={(id) => names[id] ?? id}
      canRevoke={isAdmin}
      onRevoke={async (id) => {
        await api.revokeSession(id);
        setSessions((prev) => prev.filter((s) => s.id !== id));
      }}
      loading={loading}
      loadError={loadError}
      description={t("kit.settings.sessionsHint")}
    />
  );
}

export function SettingsPage() {
  const t = useKitT();
  const { manifest, user } = useFrame();
  const config = useMemo(() => settingsConfig(manifest), [manifest]);
  const headerRight = user ? (
    <span className="text-xs text-[var(--color-text-muted)]">
      {t("kit.settings.signedInAs")} <span className="font-medium text-[var(--color-text-secondary)]">{user.username}</span>
      {" · "}
      <span className="text-[11px] font-medium">{roleLabel(user.role, t)}</span>
    </span>
  ) : undefined;

  return (
    <SettingsShell
      config={config}
      currentUserRole={user?.role ?? ""}
      title={t("settings.title")}
      headerRight={headerRight}
      panels={{
        system: <SystemTab />,
        agents: <AgentsTab />,
        konto: <AccountTab />,
        users: <UsersTab />,
        sessions: <SessionsTab />,
        web: <WebAccountsTab />,
      }}
    />
  );
}
