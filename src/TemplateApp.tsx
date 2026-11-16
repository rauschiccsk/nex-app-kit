// The whole frame of an app, chosen by its manifest — and, since DEV-252, the session too: the frame asks the server
// who is signed in (GET /auth/me; the session is an HttpOnly cookie the page never sees) and shows the sign-in, the
// sentence that a launched app is opened again from NEX Manager, or the password change due. The app keeps only its
// router and its pages:
//
//   import data from "../app.manifest.json";
//   const manifest = defineApp(data, { counts: { "/areas": useAreaCount } });
//
//   <BrowserRouter>
//     <TemplateApp manifest={manifest} frontendVersion={import.meta.env.VITE_APP_VERSION} overview={<OverviewPage />}>
//       <Route path="/areas" element={<AreasPage />} />
//     </TemplateApp>
//   </BrowserRouter>
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, createApiClient, I18nProvider, onServerChange, registerAuthCallback, type ApiClient } from "nex-shared";

import { FrameContext, type Frame } from "./frame/FrameContext";
import { createLayoutStore } from "./frame/layoutStore";
import { ChangePasswordScreen, ClosedScreen, LoadingScreen, LoginScreen, UnavailableScreen } from "./frame/screens";
import { ThemeProvider } from "./frame/theme";
import type { AppManifest } from "./manifest";
import { ADMIN_ROLE, createStandardApi, type CurrentUser } from "./standard-api";
import { InstallationContext, useInstallation, useInstallationWindow } from "./frame/installation";
import { TEMPLATES } from "./templates/registry";
import { chooseLanguage, mergeMessages, useKitT } from "./i18n";

export interface TemplateAppProps {
  manifest: AppManifest;
  /** The app's API client; by default one for the same address, prefix /api/v1, with the session cookie. */
  client?: ApiClient;
  /** The frontend's build version (e.g. import.meta.env.VITE_APP_VERSION). */
  frontendVersion?: string;
  /** Prehľad — the app's own overview. */
  overview: ReactNode;
  /** The app's own pages as <Route> elements. */
  children?: ReactNode;
}

type Session =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "out"; why: "start" | "logout" | "expired" }
  | { kind: "in"; user: CurrentUser };

/** DEV-394: keys of the template's catalogs — said in the person's language. */
export const SIGNED_OUT_SENTENCES = {
  managerExpired: "kit.signedOut.managerExpired",
  managerLogout: "kit.signedOut.managerLogout",
  passwordExpired: "kit.signedOut.passwordExpired",
} as const;

/** The screens before the frame say their sentence in the person's language. */
function SignedOut({ manifest, api, why, onSignedIn }: {
  manifest: AppManifest;
  api: ReturnType<typeof createStandardApi>;
  why: "start" | "logout" | "expired";
  onSignedIn: (user: CurrentUser) => void;
}) {
  const t = useKitT();
  return manifest.auth === "manager" ? (
    <ClosedScreen
      manifest={manifest}
      sentence={t(why === "logout" ? SIGNED_OUT_SENTENCES.managerLogout : SIGNED_OUT_SENTENCES.managerExpired)}
    />
  ) : (
    <LoginScreen
      manifest={manifest}
      api={api}
      note={why === "expired" ? t(SIGNED_OUT_SENTENCES.passwordExpired) : undefined}
      onSignedIn={onSignedIn}
    />
  );
}

function sameOriginClient(): ApiClient {
  return createApiClient({ baseUrl: "", apiPrefix: "/api/v1", getToken: () => null });
}

export function TemplateApp({ manifest, client, frontendVersion, overview, children }: TemplateAppProps) {
  const api = useMemo(() => createStandardApi(client ?? sameOriginClient()), [client]);
  // DEV-377: whom this installation serves — the window, the panel, the sign-in card and a UAT's band say it.
  const installation = useInstallation(api);
  useInstallationWindow(manifest.name, installation);
  const [layout] = useState(() => createLayoutStore(api));
  const [session, setSession] = useState<Session>({ kind: "loading" });

  const ask = useCallback(() => {
    let live = true;
    setSession({ kind: "loading" });
    api
      .me()
      .then((user) => live && setSession({ kind: "in", user }))
      .catch((e: unknown) => {
        if (!live) return;
        setSession(e instanceof ApiError && e.status === 401 ? { kind: "out", why: "start" } : { kind: "unavailable" });
      });
    return () => {
      live = false;
    };
  }, [api]);

  useEffect(ask, [ask]);

  // Any answer 401 while working (the session ended elsewhere, or timed out) — back to signing in.
  useEffect(() => {
    registerAuthCallback(() => setSession((s) => (s.kind === "in" ? { kind: "out", why: "expired" } : s)));
  }, []);

  // DEV-311 — the frame's copy of the signed-in person follows every change of that person, wherever it was made (Moje
  // konto, Používatelia, an app's own screen): Moje konto, the left panel and „Prihlásený ako“ never show a stale person.
  // 05.11.2026 NEX Manager: the e-mail changed in Používatelia, Moje konto kept the old one until the page was reloaded.
  const signedInId = session.kind === "in" ? session.user.id : null;
  useEffect(() => {
    if (!signedInId) return;
    return onServerChange(({ path }) => {
      if (path !== "/auth/me" && path !== `/users/${signedInId}` && !path.startsWith(`/users/${signedInId}/`)) return;
      api
        .me()
        .then((fresh) => setSession((s) => (s.kind === "in" && s.user.id === fresh.id ? { kind: "in", user: fresh } : s)))
        .catch(() => undefined);
    });
  }, [api, signedInId]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setSession({ kind: "out", why: "logout" });
    }
  }, [api]);

  const user = session.kind === "in" ? session.user : null;
  const setUser = useCallback((next: CurrentUser) => setSession({ kind: "in", user: next }), []);
  const frame = useMemo<Frame | null>(
    () =>
      user && {
        manifest,
        api,
        user,
        setUser,
        isAdmin: user.role === ADMIN_ROLE,
        onLogout: () => void logout(),
        frontendVersion,
        layout,
      },
    [manifest, api, user, setUser, logout, frontendVersion, layout],
  );
  const Template = TEMPLATES[manifest.template];

  let screen: ReactNode;
  if (session.kind === "loading") {
    screen = <LoadingScreen />;
  } else if (session.kind === "unavailable") {
    screen = <UnavailableScreen manifest={manifest} onRetry={ask} />;
  } else if (session.kind === "out") {
    screen = <SignedOut manifest={manifest} api={api} why={session.why} onSignedIn={setUser} />;
  } else if (session.user.must_change_password && manifest.auth === "password") {
    screen = (
      <ChangePasswordScreen
        manifest={manifest}
        api={api}
        onChanged={() => setUser({ ...session.user, must_change_password: false })}
        onLogout={() => void logout()}
      />
    );
  } else {
    screen = (
      <FrameContext.Provider value={frame}>
        <Template overview={overview}>{children}</Template>
      </FrameContext.Provider>
    );
  }

  // DEV-394: the person's language — their own choice, else the installation's, else the app's first; already on the
  // sign-in, where nobody is known yet.
  const language = chooseLanguage(manifest.languages, user?.language, installation?.language);
  const messages = useMemo(() => mergeMessages(manifest.messages), [manifest.messages]);
  // DEV-415: the page says which language it is in — the browser offers no translation from Slovak to a Hungarian
  // reader, a screen reader reads it with the right voice, spelling is checked in it. Until 0.16.0 index.html said
  // „sk“ whatever the person read.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  return (
    <I18nProvider language={language} messages={messages}>
      <ThemeProvider username={user?.username}>
        <InstallationContext.Provider value={installation}>{screen}</InstallationContext.Provider>
      </ThemeProvider>
    </I18nProvider>
  );
}
