// Aktualizácie — what is new in each version, from the app's release notes (GET /release-notes), shown by the shared
// changelog of nex-shared, as in the cockpit.
import { useCallback, useEffect, useState } from "react";
import { ReleaseNotes, type ReleaseNote } from "nex-shared";

import { useFrame } from "../../../frame/FrameContext";
import { errorText } from "../../../frame/people";

export function UpdatesPage() {
  const { api, manifest } = useFrame();
  const [notes, setNotes] = useState<ReleaseNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setNotes(await api.releaseNotes());
    } catch (e) {
      setError(errorText(e, "Načítanie aktualizácií zlyhalo."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ReleaseNotes
      notes={notes}
      loading={loading}
      error={error || null}
      onDismissError={() => setError("")}
      appName={manifest.name}
    />
  );
}
