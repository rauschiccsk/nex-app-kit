// DEV-535 — Nastavenia → Sprievodca: how well the guide works, for the admin — how many goals people reached, where they
// stopped the guiding, what the catalog of steps lacks, their ratings, ideas and Sprievodca's own notes. The Director
// 28.11.2026: „…niečo čo by nám dával spätnú väzbu o tom do akej miery funguje táto vrstva dobre.“
import { useEffect, useState } from "react";
import { Card, type DataTableColumn } from "nex-shared";

import { useFrame } from "../../../frame/FrameContext";
import { errorText } from "../../../frame/people";
import { useKitT } from "../../../i18n";
import { KitTable } from "../../../screens/KitTable";
import type { GuideFeedbackRead } from "../../../standard-api";

type FeedbackEvent = GuideFeedbackRead["events"][number];

export function GuideFeedbackTab() {
  const t = useKitT();
  const { api } = useFrame();
  const [feedback, setFeedback] = useState<GuideFeedbackRead | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .guideFeedback()
      .then(setFeedback)
      .catch((e: unknown) => setError(errorText(e, t("kit.guiding.fb.loadFailed"))));
  }, [api, t]);

  if (error) return <p role="alert" className="text-sm text-[var(--color-state-error-fg)]">{error}</p>;
  if (!feedback?.totals) return null;
  const { totals } = feedback;
  const figures: [string, string | number][] = [
    ["kit.guiding.fb.sessions", totals.sessions],
    ["kit.guiding.fb.done", totals.done],
    ["kit.guiding.fb.stopped", totals.stopped],
    ["kit.guiding.fb.missing", totals.missing],
    ["kit.guiding.fb.guiding", totals.guiding],
    ["kit.guiding.fb.ratings", `${totals.rated_up} / ${totals.rated_down}`],
  ];
  const columns: DataTableColumn<FeedbackEvent>[] = [
    { key: "kind", header: t("kit.guiding.fb.what"), render: (e) => t(`kit.guiding.kind.${e.kind}`) },
    { key: "goal", header: t("kit.guiding.fb.goal"), render: (e) => e.goal ?? "—" },
    { key: "step", header: t("kit.guiding.fb.step"), render: (e) => e.step_id ?? "—" },
    { key: "detail", header: t("kit.guiding.fb.detail"), render: (e) => e.detail ?? "—" },
    { key: "when", header: t("kit.guiding.fb.when"), render: (e) => (e.created_at ? new Date(e.created_at).toLocaleString() : "—") },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-[var(--color-text-secondary)]">{t("kit.guiding.fb.hint")}</p>
      <div className="flex flex-wrap gap-3" aria-label={t("kit.guiding.fb.sessions")}>
        {figures.map(([label, value]) => (
          <Card key={label} className="min-w-32 p-3">
            <p className="text-xs text-[var(--color-text-muted)]">{t(label)}</p>
            <p className="text-xl font-semibold">{value}</p>
          </Card>
        ))}
      </div>
      {(feedback.events ?? []).length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">{t("kit.guiding.fb.empty")}</p>
      ) : (
        <KitTable columns={columns} rows={feedback.events} getRowKey={(e) => `${e.kind}:${e.created_at}:${e.step_id}:${e.detail}`} />
      )}
    </div>
  );
}
