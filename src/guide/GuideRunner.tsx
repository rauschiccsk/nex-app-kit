// DEV-535 — Sprievodca leading the person step by step: the card in the corner of every screen. For each step it opens
// the step's screen, marks its button, says the one sentence what to do and moves on by itself when the step's check
// says it is done — the person always clicks (the Director 28.11.2026, the plan: „súhlasím“). What it reports while
// guiding is the feedback the Director asked for: a person stuck on a step, a button not on the screen, a step the app
// did not see done, a step skipped, a guiding stopped and why, a goal reached.
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "nex-shared";

import { useFrame } from "../frame/FrameContext";
import { useKitT } from "../i18n";
import type { GuideStopReason } from "../standard-api";
import type { GuideStep } from "./catalog";
import { useGuide } from "./store";

/** How often the step's check is asked whether the step is done. */
export const CHECK_EVERY_MS = 2000;
/** How long on one step counts as stuck — reported once per step. */
export const STUCK_AFTER_MS = 3 * 60 * 1000;
/** How long the step's button is looked for after its screen opens. */
export const TARGET_WAIT_MS = 6000;
const REASONS: GuideStopReason[] = ["unclear", "did_otherwise", "not_needed"];

function mark(element: HTMLElement): () => void {
  const before = element.style.boxShadow;
  element.style.boxShadow = "0 0 0 3px var(--color-accent-primary, #6366f1), 0 0 0 7px rgba(99, 102, 241, 0.25)";
  element.setAttribute("data-guide-active", "true");
  element.scrollIntoView?.({ block: "center", behavior: "smooth" });
  return () => {
    element.style.boxShadow = before;
    element.removeAttribute("data-guide-active");
  };
}

export function GuideRunner() {
  const t = useKitT();
  const navigate = useNavigate();
  const { api, manifest } = useFrame();
  const guide = useGuide();
  const [noTarget, setNoTarget] = useState(false);
  const [stopping, setStopping] = useState(false);
  const busy = useRef(false);

  const path = guide.steps;
  const at = path[guide.current];
  const step: GuideStep | undefined = at ? manifest.guideCatalog.steps.find((s) => s.id === at.id) : undefined;
  const subject = at?.subject ?? undefined;

  // The store is read as it is NOW in every check and move — a value captured at render may be stale by the time an
  // interval's answer comes back (a stay reported 92 times instead of once, caught by the test of DEV-535).
  const report = useCallback(
    (kind: "stuck" | "not_detected" | "no_target" | "skipped") => {
      const now = useGuide.getState();
      const where = now.steps[now.current];
      if (!now.sessionId || !where) return;
      void api.guideEvent({ kind, session_id: now.sessionId, step_id: where.id }).catch(() => undefined);
    },
    [api],
  );

  const advance = useCallback(async () => {
    const now = useGuide.getState();
    if (busy.current || !now.sessionId || now.phase !== "guiding") return;
    busy.current = true;
    try {
      const next = now.current + 1;
      if (next >= now.steps.length) {
        await api.guideProgress(now.sessionId, "done", now.steps.length).catch(() => undefined);
        now.finish();
        now.setOpen(true);
      } else {
        await api.guideProgress(now.sessionId, "guiding", next).catch(() => undefined);
        now.goTo(next, Date.now());
      }
    } finally {
      busy.current = false;
    }
  }, [api]);

  // The step's screen and its button — opened and marked when the step begins (and on „Ukáž“).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (guide.phase !== "guiding" || !step) return;
    setNoTarget(false);
    navigate(step.path(subject));
    const target = step.target ?? step.id;
    let unmark: (() => void) | null = null;
    const started = Date.now();
    const look = setInterval(() => {
      const element = document.querySelector<HTMLElement>(`[data-guide="${CSS.escape(target)}"]`);
      if (element) {
        clearInterval(look);
        unmark = mark(element);
      } else if (Date.now() - started > TARGET_WAIT_MS) {
        clearInterval(look);
        setNoTarget(true);
        report("no_target");
      }
    }, 300);
    return () => {
      clearInterval(look);
      unmark?.();
    };
    // `report` changes with the session only; the step and the „Ukáž“ count decide.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guide.phase, guide.current, step?.id, subject, shown]);

  // Done? — asked again and again; and a long stay is reported once.
  useEffect(() => {
    if (guide.phase !== "guiding" || !step) return;
    let alive = true;
    const tick = setInterval(() => {
      void Promise.resolve()
        .then(() => step.isDone(subject))
        .then((done) => {
          const now = useGuide.getState();
          if (!alive || now.phase !== "guiding") return;
          if (done) void advance();
          else if (!now.stuckReported && now.stepSince && Date.now() - now.stepSince > STUCK_AFTER_MS) {
            now.markStuck();
            report("stuck");
          }
        })
        .catch(() => undefined);
    }, CHECK_EVERY_MS);
    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, [guide.phase, guide.current, step, subject, advance, report]);

  if (guide.phase !== "guiding" || !at) return null;

  async function confirmDone() {
    const done = step ? await Promise.resolve(step.isDone(subject)).catch(() => false) : false;
    if (!done) report("not_detected");
    await advance();
  }

  async function stop(reason: GuideStopReason) {
    const now = useGuide.getState();
    if (now.sessionId) await api.guideProgress(now.sessionId, "stopped", now.current, reason).catch(() => undefined);
    setStopping(false);
    guide.reset();
  }

  return (
    <section
      role="dialog"
      aria-label={t("kit.guiding.name")}
      className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 shadow-xl"
    >
      <p className="text-xs text-[var(--color-text-muted)]">
        🧭 {t("kit.guiding.name")} · {t("kit.guiding.step", { current: guide.current + 1, total: path.length })}
      </p>
      <p className="text-sm font-semibold">{at.title}</p>
      {step && <p className="text-sm text-[var(--color-text-secondary)]">{t(step.hint)}</p>}
      {noTarget && <p className="text-xs text-[var(--color-state-warning-fg)]">{t("kit.guiding.noTarget")}</p>}
      {stopping ? (
        <div className="flex flex-col gap-1">
          <p className="text-sm">{t("kit.guiding.why")}</p>
          {REASONS.map((reason) => (
            <Button key={reason} size="sm" variant="secondary" onClick={() => void stop(reason)}>
              {t(`kit.guiding.reason.${reason}`)}
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShown((n) => n + 1)}>
            {t("kit.guiding.show")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void confirmDone()}>
            {t("kit.guiding.done")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              report("skipped");
              void advance();
            }}
          >
            {t("kit.guiding.skip")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setStopping(true)}>
            {t("kit.guiding.stop")}
          </Button>
        </div>
      )}
    </section>
  );
}
