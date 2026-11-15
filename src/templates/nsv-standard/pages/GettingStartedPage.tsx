// Ako začať — the app's own guide for a person who has never seen it. The agent writes it into the project's
// documents (as the UAT guide); the server hands it out (GET /getting-started) and the template shows it.
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Page } from "nex-shared";

import { useFrame } from "../../../frame/FrameContext";
import { errorText } from "../../../frame/people";
import { useKitT } from "../../../i18n";

// Headings stay under the page's own title (text-xl): a guide's „## Prvé kroky“ is a section, not a second title.
const PROSE = `prose prose-base dark:prose-invert max-w-none prose-headings:font-semibold
  prose-h1:text-lg prose-h2:text-base prose-h2:text-primary-500 prose-h2:mt-6 prose-h2:mb-2 prose-h3:text-base
  prose-p:text-[var(--color-text-secondary)] prose-p:leading-relaxed prose-strong:text-[var(--color-text-primary)]
  prose-li:text-[var(--color-text-secondary)] prose-li:marker:text-primary-500`;

export function GettingStartedPage() {
  const t = useKitT();
  const { api } = useFrame();
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    api
      .gettingStarted()
      .then((g) => live && setMarkdown(g.markdown ?? ""))
      .catch((e: unknown) => live && setError(errorText(e, t("kit.guide.noServer"))));
    return () => {
      live = false;
    };
  }, [api, t]);

  return (
    <Page title={t("kit.place.gettingStarted")} width="narrow">
      {error ? (
        <p className="text-sm text-[var(--color-status-error)]">
          {t("kit.guide.failed")} {error}
        </p>
      ) : markdown === null ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t("common.loading")}</p>
      ) : markdown.trim() === "" ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t("kit.guide.none")}</p>
      ) : (
        <div className={PROSE}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      )}
    </Page>
  );
}
