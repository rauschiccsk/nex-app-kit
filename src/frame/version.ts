// The version under the app's name: the server leads (the cockpit's ICCINT-128) — the frontend's own number is said
// only when it differs, so a half-deployed app shows it.
import { useEffect, useState } from "react";

import type { StandardApi } from "../standard-api";

export function versionLine(backend: string | null | undefined, frontend: string | null | undefined): string | undefined {
  const be = (backend ?? "").trim();
  const fe = (frontend ?? "").trim();
  if (!be) return fe ? `v${fe}` : undefined;
  if (!fe || fe === be) return `v${be}`;
  return `backend v${be} · frontend v${fe}`;
}

export function useBackendVersion(api: StandardApi): string | undefined {
  const [version, setVersion] = useState<string>();
  useEffect(() => {
    let live = true;
    api
      .health()
      .then((h) => live && setVersion(h.version))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [api]);
  return version;
}
