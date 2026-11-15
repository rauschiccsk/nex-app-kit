// The screens before the frame (DEV-252): signing in with the app's own password, the sentence that a launched app
// is opened again from NEX Manager, the password change due at the first sign-in, and a server that does not answer.
import { useState, type FormEvent, type ReactNode } from "react";
import { Brand, Button, Card, Input, LoginForm } from "nex-shared";

import type { AppManifest } from "../manifest";
import type { CurrentUser, StandardApi } from "../standard-api";
import { InstallationCustomer, InstallationUat } from "./installation";
import { errorText } from "./people";
import { useKitT } from "../i18n";

function Centered({ manifest, children }: { manifest: AppManifest; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-canvas)] p-6">
      <Card className="w-full max-w-sm">
        <div className="mb-5">
          <Brand initials={manifest.initials} name={manifest.name} />
          {/* DEV-377: whose installation one signs in to — and a test one says so before the password goes in. */}
          <InstallationCustomer className="mt-2" />
          <InstallationUat />
        </div>
        {children}
      </Card>
    </div>
  );
}

export function LoadingScreen() {
  const t = useKitT();
  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-canvas)] text-sm text-[var(--color-text-muted)]">
      {t("common.loading")}
    </div>
  );
}

export function LoginScreen({
  manifest,
  api,
  note,
  onSignedIn,
}: {
  manifest: AppManifest;
  api: StandardApi;
  note?: string;
  onSignedIn: (user: CurrentUser) => void;
}) {
  const t = useKitT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn({ username, password }: { username: string; password: string }) {
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.login(username, password));
    } catch (e) {
      setError(errorText(e, t("kit.login.failed")));
      setBusy(false);
    }
  }

  return (
    <Centered manifest={manifest}>
      {note && <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{note}</p>}
      <LoginForm
        onSubmit={signIn}
        loading={busy}
        error={error}
        onChange={() => setError(null)}
        autoFocus
        identityLabel={t("kit.login.identity")}
        passwordLabel={t("login.password")}
        submitLabel={t("login.submit")}
        loadingLabel={t("kit.login.loading")}
      />
    </Centered>
  );
}

/** Launched from NEX Manager and signed out: the way back is NEX Manager, never a form here. */
export function ClosedScreen({ manifest, sentence }: { manifest: AppManifest; sentence: string }) {
  return (
    <Centered manifest={manifest}>
      <p className="text-sm text-[var(--color-text-secondary)]">{sentence}</p>
    </Centered>
  );
}

export function UnavailableScreen({ manifest, onRetry }: { manifest: AppManifest; onRetry: () => void }) {
  const t = useKitT();
  return (
    <Centered manifest={manifest}>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("kit.unavailable")}</p>
      <Button onClick={onRetry}>{t("kit.retry")}</Button>
    </Centered>
  );
}

/** The first admin and every person with a password from the admin choose their own before anything else. */
export function ChangePasswordScreen({
  manifest,
  api,
  onChanged,
  onLogout,
}: {
  manifest: AppManifest;
  api: StandardApi;
  onChanged: () => void;
  onLogout: () => void;
}) {
  const t = useKitT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== again) {
      setError(t("kit.password.mismatch"));
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      onChanged();
    } catch (err) {
      setError(errorText(err, t("kit.password.failed")));
      setBusy(false);
    }
  }

  const label = "mb-1 block text-xs text-[var(--color-text-muted)]";
  return (
    <Centered manifest={manifest}>
      <h1 className="mb-1 text-base font-semibold text-[var(--color-text-primary)]">{t("kit.password.title")}</h1>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{t("kit.password.why")}</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="kit-current" className={label}>
            {t("account.currentPassword")}
          </label>
          <Input id="kit-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label htmlFor="kit-new" className={label}>
            {t("password.new")}
          </label>
          <Input
            id="kit-new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="kit-again" className={label}>
            {t("account.repeatPassword")}
          </label>
          <Input id="kit-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-[var(--color-status-error)]">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button type="button" onClick={onLogout} className="text-xs text-[var(--color-text-muted)] hover:underline">
            {t("user.logout")}
          </button>
          <Button type="submit" disabled={busy || !current || !next || !again}>
            {busy ? t("common.saving") : t("kit.password.submit")}
          </Button>
        </div>
      </form>
    </Centered>
  );
}
