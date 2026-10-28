// The screens before the frame (DEV-252): signing in with the app's own password, the sentence that a launched app
// is opened again from NEX Manager, the password change due at the first sign-in, and a server that does not answer.
import { useState, type FormEvent, type ReactNode } from "react";
import { Brand, Button, Card, Input, LoginForm } from "nex-shared";

import type { AppManifest } from "../manifest";
import { PASSWORD_MIN_LENGTH, type CurrentUser, type StandardApi } from "../standard-api";
import { errorText } from "./people";

function Centered({ manifest, children }: { manifest: AppManifest; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-canvas)] p-6">
      <Card className="w-full max-w-sm">
        <div className="mb-5">
          <Brand initials={manifest.initials} name={manifest.name} />
        </div>
        {children}
      </Card>
    </div>
  );
}

export function LoadingScreen() {
  return (
    <div className="flex min-h-full items-center justify-center bg-[var(--color-canvas)] text-sm text-[var(--color-text-muted)]">
      Načítavam…
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn({ username, password }: { username: string; password: string }) {
    setBusy(true);
    setError(null);
    try {
      onSignedIn(await api.login(username, password));
    } catch (e) {
      setError(errorText(e, "Prihlásenie sa nepodarilo."));
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
        identityLabel="Prihlasovacie meno"
        passwordLabel="Heslo"
        submitLabel="Prihlásiť sa"
        loadingLabel="Prihlasujem…"
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
  return (
    <Centered manifest={manifest}>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Aplikácia teraz neodpovedá. Skús to o chvíľu znova.</p>
      <Button onClick={onRetry}>Skúsiť znova</Button>
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
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (next !== again) {
      setError("Nové heslá sa nezhodujú.");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      onChanged();
    } catch (err) {
      setError(errorText(err, "Zmena hesla sa nepodarila."));
      setBusy(false);
    }
  }

  const label = "mb-1 block text-xs text-[var(--color-text-muted)]";
  return (
    <Centered manifest={manifest}>
      <h1 className="mb-1 text-base font-semibold text-[var(--color-text-primary)]">Nastav si vlastné heslo</h1>
      <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
        Heslo na prvé prihlásenie ti nastavil niekto iný. Kým si nastavíš vlastné, aplikácia sa neotvorí.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="kit-current" className={label}>
            Súčasné heslo
          </label>
          <Input id="kit-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div>
          <label htmlFor="kit-new" className={label}>
            Nové heslo
          </label>
          <Input
            id="kit-new"
            type="password"
            autoComplete="new-password"
            placeholder={`aspoň ${PASSWORD_MIN_LENGTH} znakov`}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="kit-again" className={label}>
            Zopakuj nové heslo
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
            Odhlásiť sa
          </button>
          <Button type="submit" disabled={busy || !current || !next || !again}>
            {busy ? "Ukladám…" : "Nastaviť heslo"}
          </Button>
        </div>
      </form>
    </Centered>
  );
}
