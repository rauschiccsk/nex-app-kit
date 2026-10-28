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
import { ApiError, createApiClient, registerAuthCallback, type ApiClient } from "nex-shared";

import { FrameContext, type Frame } from "./frame/FrameContext";
import { createLayoutStore } from "./frame/layoutStore";
import { ChangePasswordScreen, ClosedScreen, LoadingScreen, LoginScreen, UnavailableScreen } from "./frame/screens";
import { ThemeProvider } from "./frame/theme";
import type { AppManifest } from "./manifest";
import { ADMIN_ROLE, createStandardApi, type CurrentUser } from "./standard-api";
import { TEMPLATES } from "./templates/registry";

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

export const SIGNED_OUT_SENTENCES = {
  managerExpired: "Prihlásenie vypršalo. Aplikáciu otvor znova z NEX Managera.",
  managerLogout: "Odhlásenie prebehlo. Aplikáciu otvoríš znova z NEX Managera.",
  passwordExpired: "Prihlásenie vypršalo. Prihlás sa znova.",
} as const;

function sameOriginClient(): ApiClient {
  return createApiClient({ baseUrl: "", apiPrefix: "/api/v1", getToken: () => null });
}

export function TemplateApp({ manifest, client, frontendVersion, overview, children }: TemplateAppProps) {
  const api = useMemo(() => createStandardApi(client ?? sameOriginClient()), [client]);
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
    screen =
      manifest.auth === "manager" ? (
        <ClosedScreen
          manifest={manifest}
          sentence={session.why === "logout" ? SIGNED_OUT_SENTENCES.managerLogout : SIGNED_OUT_SENTENCES.managerExpired}
        />
      ) : (
        <LoginScreen
          manifest={manifest}
          api={api}
          note={session.why === "expired" ? SIGNED_OUT_SENTENCES.passwordExpired : undefined}
          onSignedIn={setUser}
        />
      );
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

  return <ThemeProvider username={user?.username}>{screen}</ThemeProvider>;
}
