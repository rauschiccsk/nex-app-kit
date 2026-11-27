// DEV-523 — the frame of an app's web (web/): its own accounts signed in by e-mail, a registration that is a request
// the admin decides in the administration, a top bar with the person and „Odhlásiť sa“, and the app's own web pages
// for whoever is signed in. 26.11.2026 orthodox-register: the priests use the web, the administrator the
// administration. The Director on the proposal (own web accounts, sign-in by e-mail, a request the admin approves):
// „Súhlasím“. The server side is the kit's too (KONTRAKT.md → Web).
import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, Route, Routes } from "react-router-dom";
import {
  Button,
  Card,
  createApiClient,
  FormField,
  I18nProvider,
  Input,
  PasswordInput,
  type ApiClient,
} from "nex-shared";

import { errorText } from "../frame/people";
import { mergeMessages, useKitT } from "../i18n";
import type { AppManifest } from "../manifest";
import { createStandardApi, type StandardApi, type WebAccountRead } from "../standard-api";

export interface WebAppProps {
  manifest: AppManifest;
  /** The web's API client; by default one for the same address, prefix /api/v1, with the session cookie. */
  client?: ApiClient;
  /** The first page of the signed-in person. */
  home: ReactNode;
  /** The web's own pages as <Route> elements — for the signed-in person. */
  children?: ReactNode;
}

interface WebFrame {
  account: WebAccountRead;
  api: StandardApi;
}

const WebFrameContext = createContext<WebFrame | null>(null);

/** The account signed in to the web and the standard interface — for the app's own web pages. */
export function useWebAccount(): WebFrame {
  const frame = useContext(WebFrameContext);
  if (!frame) throw new Error("useWebAccount works inside <WebApp> only");
  return frame;
}

function defaultClient(): ApiClient {
  return createApiClient({ baseUrl: "", apiPrefix: "/api/v1", getToken: () => null });
}

export function WebApp({ manifest, client, home, children }: WebAppProps) {
  const api = useMemo(() => createStandardApi(client ?? defaultClient()), [client]);
  const messages = useMemo(() => mergeMessages(manifest.messages), [manifest]);
  // undefined — still asking the server who is signed in; null — nobody.
  const [account, setAccount] = useState<WebAccountRead | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    api
      .webMe()
      .then((found) => alive && setAccount(found))
      .catch(() => alive && setAccount(null));
    return () => {
      alive = false;
    };
  }, [api]);

  return (
    <I18nProvider language={manifest.languages[0] ?? "sk"} messages={messages}>
      <div className="min-h-full bg-[var(--color-canvas)] text-[var(--color-text-primary)]">
        {account === undefined ? null : account === null ? (
          <Routes>
            <Route path="/register" element={<RegisterPage manifest={manifest} api={api} />} />
            <Route path="*" element={<SignInPage manifest={manifest} api={api} onSignedIn={setAccount} />} />
          </Routes>
        ) : (
          <WebFrameContext.Provider value={{ account, api }}>
            <TopBar manifest={manifest} account={account} onSignedOut={() => setAccount(null)} />
            <main className="mx-auto w-full max-w-5xl px-4 py-6">
              <Routes>
                <Route path="/" element={home} />
                {children}
              </Routes>
            </main>
          </WebFrameContext.Provider>
        )}
      </div>
    </I18nProvider>
  );
}

function TopBar({ manifest, account, onSignedOut }: { manifest: AppManifest; account: WebAccountRead; onSignedOut: () => void }) {
  const t = useKitT();
  const { api } = useWebAccount();
  const name = [account.first_name, account.last_name].filter(Boolean).join(" ") || account.email;
  return (
    <header className="flex items-center justify-between gap-4 border-b border-[var(--color-border-default)] px-4 py-3">
      <span className="font-semibold">{manifest.name}</span>
      <span className="flex items-center gap-3 text-sm">
        <span className="text-[var(--color-text-secondary)]">{name}</span>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            void api.webLogout().finally(onSignedOut);
          }}
        >
          {t("kit.web.signOut")}
        </Button>
      </span>
    </header>
  );
}

function Centered({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-start justify-center px-4 py-12">
      <Card className="w-full max-w-sm p-6">
        <h1 className="mb-4 text-lg font-semibold">{title}</h1>
        {children}
      </Card>
    </div>
  );
}

function SignInPage({ manifest, api, onSignedIn }: { manifest: AppManifest; api: StandardApi; onSignedIn: (a: WebAccountRead) => void }) {
  const t = useKitT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onSignedIn(await api.webLogin(email.trim(), password));
    } catch (e: unknown) {
      setError(errorText(e, t("kit.web.signIn.failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered title={`${manifest.name} — ${t("kit.web.signIn.title")}`}>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <FormField label={t("kit.web.signIn.email")} htmlFor="web-email">
          <Input id="web-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </FormField>
        <FormField label={t("kit.web.signIn.password")} htmlFor="web-password">
          <PasswordInput id="web-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
        {error && <p role="alert" className="text-sm text-[var(--color-state-error-fg)]">{error}</p>}
        <Button type="submit" disabled={busy || !email.trim() || !password}>
          {t("kit.web.signIn.submit")}
        </Button>
      </form>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        {t("kit.web.signIn.noAccount")} <Link to="/register" className="underline">{t("kit.web.signIn.toRegister")}</Link>
      </p>
    </Centered>
  );
}

function RegisterPage({ manifest, api }: { manifest: AppManifest; api: StandardApi }) {
  const t = useKitT();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const set = (field: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.webRegister({ ...form, email: form.email.trim() });
      setSent(true);
    } catch (e: unknown) {
      setError(errorText(e, t("kit.web.register.failed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Centered title={`${manifest.name} — ${t("kit.web.register.title")}`}>
      {sent ? (
        <p role="status" className="text-sm">{t("kit.web.register.sent")}</p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <FormField label={t("kit.web.register.firstName")} htmlFor="web-first">
            <Input id="web-first" autoComplete="given-name" value={form.first_name} onChange={(e) => set("first_name")(e.target.value)} />
          </FormField>
          <FormField label={t("kit.web.register.lastName")} htmlFor="web-last">
            <Input id="web-last" autoComplete="family-name" value={form.last_name} onChange={(e) => set("last_name")(e.target.value)} />
          </FormField>
          <FormField label={t("kit.web.signIn.email")} htmlFor="web-reg-email">
            <Input id="web-reg-email" type="email" autoComplete="email" value={form.email} onChange={(e) => set("email")(e.target.value)} />
          </FormField>
          <FormField label={t("kit.web.signIn.password")} htmlFor="web-reg-password">
            <PasswordInput id="web-reg-password" autoComplete="new-password" reveal value={form.password} onChange={(e) => set("password")(e.target.value)} />
          </FormField>
          {error && <p role="alert" className="text-sm text-[var(--color-state-error-fg)]">{error}</p>}
          <Button type="submit" disabled={busy || !form.email.trim() || !form.password}>
            {t("kit.web.register.submit")}
          </Button>
        </form>
      )}
      <p className="mt-4 text-sm">
        <Link to="/" className="underline">{t("kit.web.register.toSignIn")}</Link>
      </p>
    </Centered>
  );
}
