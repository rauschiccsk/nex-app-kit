// DEV-377 — whom this installation serves and whether it is the test or the live one.
//
// 13.11.2026 the Director ran NEX Manager and could not tell for whom: the window, its header and the icon on the task
// bar all read „NEX Manager“, and ICC s.r.o. and MÁGERSTAV s.r.o. each have one on UAT and on PROD. The cockpit writes
// the customer's name and the environment into every installation it deploys; the server hands them out
// (GET /installation) and the frame says them — in the window's title, in the left panel, on the sign-in card, and a UAT
// carries a band over every page. The installed app takes its name from the same words (the server's manifest), so the
// icon on the desktop and the task bar say whose it is. An app run outside the cockpit looks as before.
import { createContext, useContext, useEffect, useState } from "react";

import type { InstallationRead, StandardApi } from "../standard-api";
import { useKitT } from "../i18n";

/** The installed app's description for this installation — the server names it by the customer and environment. */
export const INSTALLATION_MANIFEST = "/api/v1/installation/manifest.webmanifest";
/** DEV-394: the key of the band's sentence — said in the person's language. */
export const UAT_SENTENCE = "kit.uat";

/** „NEX Manager — MÁGERSTAV s.r.o. (UAT)“ — the same words the server names the installed app with. */
export function installationTitle(appName: string, installation: InstallationRead | null | undefined): string {
  const customer = installation?.customer;
  const title = customer ? `${appName} — ${customer}` : appName;
  return installation?.environment === "uat" ? `${title} (UAT)` : title;
}

export function useInstallation(api: StandardApi): InstallationRead | null {
  const [installation, setInstallation] = useState<InstallationRead | null>(null);
  useEffect(() => {
    let live = true;
    api
      .installation()
      .then((answer) => live && setInstallation(answer))
      .catch(() => undefined); // an older server: the app looks as before
    return () => {
      live = false;
    };
  }, [api]);
  return installation;
}

/** The window's title — and, once the installation is known, the installed app's description — say whose it is. */
export function useInstallationWindow(appName: string, installation: InstallationRead | null): void {
  useEffect(() => {
    document.title = installationTitle(appName, installation);
    if (!installation?.customer && !installation?.environment) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
    }
    link.href = INSTALLATION_MANIFEST;
  }, [appName, installation]);
}

export const InstallationContext = createContext<InstallationRead | null>(null);

export function useInstallationIdentity(): InstallationRead | null {
  return useContext(InstallationContext);
}

/** The band over every page of a UAT — so a test installation is never taken for the live one. Nothing on a PROD. */
export function InstallationBand() {
  const t = useKitT();
  const installation = useInstallationIdentity();
  if (installation?.environment !== "uat") return null;
  return (
    <div
      role="status"
      className="flex-shrink-0 truncate border-b border-[var(--color-status-warning)] bg-[var(--color-state-warning-bg)] px-3 py-1 text-xs font-semibold text-[var(--color-state-warning-fg)]"
    >
      {installation.customer ? `${t(UAT_SENTENCE)} — ${installation.customer}` : t(UAT_SENTENCE)}
    </div>
  );
}

/** On the sign-in card: a test installation says so before the password goes in. Nothing on a PROD. */
export function InstallationUat() {
  const t = useKitT();
  const installation = useInstallationIdentity();
  if (installation?.environment !== "uat") return null;
  return (
    <p className="mt-2 inline-block rounded border border-[var(--color-status-warning)] bg-[var(--color-state-warning-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--color-state-warning-fg)]">
      {t(UAT_SENTENCE)}
    </p>
  );
}

/** The customer's name, where the frame names the app (the left panel, the sign-in card). */
export function InstallationCustomer({ className = "" }: { className?: string }) {
  const installation = useInstallationIdentity();
  if (!installation?.customer) return null;
  return (
    <p className={`truncate text-xs font-semibold text-[var(--color-text-secondary)] ${className}`.trim()} title={installation.customer}>
      {installation.customer}
    </p>
  );
}
