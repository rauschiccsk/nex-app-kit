// DEV-535 — the conversation with Sprievodca: the person writes what they want to do; Sprievodca measures the app's
// catalog of steps, asks back when the goal is unclear, says the steps in short and offers to lead the person through
// them. At the end it asks whether it helped; an idea for improvement can be written at any time. The same conversation
// is on „Ako urobiť“ and in the panel opened from any screen.
import { useState, type FormEvent, type TextareaHTMLAttributes } from "react";
import { Button, useLanguage } from "nex-shared";

import { useFrame } from "../frame/FrameContext";
import { errorText } from "../frame/people";
import { useKitT } from "../i18n";
import { measure } from "./catalog";
import { useGuide, type GuidePhase } from "./store";

export function GuideChat() {
  const t = useKitT();
  const { language } = useLanguage();
  const { api, manifest } = useFrame();
  const guide = useGuide();
  const [text, setText] = useState("");

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const message = text.trim();
    if (!message || guide.phase === "thinking") return;
    setText("");
    guide.say({ by: "person", text: message });
    const continuing = guide.phase === "asking" && guide.sessionId ? { session_id: guide.sessionId } : {};
    guide.think();
    try {
      const measured = await measure(manifest.guideCatalog, t);
      const answer = await api.guidePlan({ message, language, ...continuing, ...measured });
      const said = answer.empty_catalog ? t("kit.guiding.noCatalog") : answer.invalid ? t("kit.guiding.invalid") : answer.text;
      if (said) guide.say({ by: "guide", text: said });
      if (answer.kind === "missing" && !answer.empty_catalog) guide.say({ by: "guide", text: t("kit.guiding.missingNote") });
      const phase: GuidePhase = answer.kind === "plan" ? "planned" : answer.kind === "missing" ? "missing" : "asking";
      guide.answered(phase, answer.session_id, answer.steps);
    } catch (e: unknown) {
      guide.say({ by: "guide", text: errorText(e, t("kit.guiding.failed")) });
      guide.answered("idle", guide.sessionId ?? "", []);
    }
  }

  async function lead() {
    if (!guide.sessionId) return;
    try {
      await api.guideProgress(guide.sessionId, "guiding", 0);
      guide.startGuiding(Date.now());
    } catch (e: unknown) {
      guide.say({ by: "guide", text: errorText(e, t("kit.guiding.failed")) });
    }
  }

  const asking = guide.phase !== "planned" && guide.phase !== "guiding" && guide.phase !== "finished";
  return (
    <div className="flex flex-col gap-3" data-testid="guide-chat">
      <p className="text-sm text-[var(--color-text-secondary)]">{t("kit.guiding.intro")}</p>
      <ol className="flex flex-col gap-2" aria-label={t("kit.guiding.name")}>
        {guide.lines.map((line, i) => (
          <li
            key={i}
            className={`rounded-lg px-3 py-2 text-sm ${
              line.by === "person"
                ? "self-end bg-[var(--color-accent-subtle,#e0e7ff)] text-[var(--color-text-primary)]"
                : "self-start bg-[var(--color-surface-muted,#f3f4f6)] text-[var(--color-text-primary)]"
            }`}
          >
            {line.text}
          </li>
        ))}
        {guide.phase === "thinking" && <li className="text-sm text-[var(--color-text-muted)]">{t("kit.guiding.thinking")}</li>}
      </ol>

      {guide.phase === "planned" && (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-default)] p-3">
          <ol className="list-decimal pl-5 text-sm">
            {guide.steps.map((step) => (
              <li key={`${step.id}:${step.subject ?? ""}`}>{step.title}</li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void lead()}>
              {t("kit.guiding.lead")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => guide.answered("idle", guide.sessionId ?? "", [])}>
              {t("kit.guiding.alone")}
            </Button>
          </div>
        </div>
      )}

      {guide.phase === "finished" && <Rating />}

      {asking && (
        <form onSubmit={(e) => void send(e)} className="flex flex-col gap-2">
          <Area
            aria-label={t("kit.guiding.placeholder")}
            placeholder={t("kit.guiding.placeholder")}
            value={text}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) void send(e as unknown as FormEvent);
            }}
          />
          <div>
            <Button size="sm" type="submit" disabled={!text.trim() || guide.phase === "thinking"}>
              {t("kit.guiding.send")}
            </Button>
          </div>
        </form>
      )}

      {(guide.phase === "finished" || guide.phase === "missing" || guide.lines.length > 0) && guide.phase !== "guiding" && (
        <div>
          <Button size="sm" variant="secondary" onClick={() => guide.reset()}>
            {t("kit.guiding.newGoal")}
          </Button>
        </div>
      )}
      <Idea />
    </div>
  );
}

/** „Pomohol vám Sprievodca?“ — a thumb and, if the person wants, a sentence. */
function Rating() {
  const t = useKitT();
  const { api } = useFrame();
  const guide = useGuide();
  const [comment, setComment] = useState("");
  if (guide.rated) return <p className="text-sm text-[var(--color-text-secondary)]">{t("kit.guiding.thanks")}</p>;
  const rate = (rating: "up" | "down") => {
    if (!guide.sessionId) return;
    void api
      .guideRate(guide.sessionId, rating, comment.trim() || undefined)
      .then(() => guide.markRated())
      .catch(() => guide.markRated());
  };
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-default)] p-3">
      <p className="text-sm font-semibold">{t("kit.guiding.finished")}</p>
      <p className="text-sm">{t("kit.guiding.helped")}</p>
      <Area aria-label={t("kit.guiding.comment")} placeholder={t("kit.guiding.comment")} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => rate("up")}>
          👍 {t("kit.guiding.yes")}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => rate("down")}>
          👎 {t("kit.guiding.no")}
        </Button>
      </div>
    </div>
  );
}

/** An idea for improvement — at any time, with the conversation when there is one. */
function Idea() {
  const t = useKitT();
  const { api } = useFrame();
  const sessionId = useGuide((s) => s.sessionId);
  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [sent, setSent] = useState(false);
  if (sent) return <p className="text-sm text-[var(--color-text-secondary)]">{t("kit.guiding.ideaSent")}</p>;
  if (!open) {
    return (
      <button type="button" className="self-start text-sm text-[var(--color-text-secondary)] underline" onClick={() => setOpen(true)}>
        {t("kit.guiding.idea")}
      </button>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <Area aria-label={t("kit.guiding.idea")} placeholder={t("kit.guiding.ideaPlaceholder")} rows={2} value={idea} onChange={(e) => setIdea(e.target.value)} />
      <div>
        <Button
          size="sm"
          variant="secondary"
          disabled={!idea.trim()}
          onClick={() =>
            void api.guideEvent({ kind: "idea", detail: idea.trim(), ...(sessionId ? { session_id: sessionId } : {}) }).then(() => setSent(true))
          }
        >
          {t("kit.guiding.send")}
        </Button>
      </div>
    </div>
  );
}

const AREA =
  "w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-canvas)] px-3 py-2 text-sm " +
  "text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]";

/** A multi-line field of the conversation — spell-checked in the person's language. */
function Area(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { language } = useLanguage();
  return <textarea {...props} lang={language} spellCheck className={AREA} />;
}
