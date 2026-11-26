// DEV-517 — every screen of an app on the template: nex-shared's <Page> with the back link „← <previous screen>“
// above it when the screen was opened from another one. The back link returns there with the filters and the tab it
// had, step by step; a left-panel entry (or a template screen) starts a new walk, so its screen has none. NEX DualBook
// 0.1.0, Vizuál 26.11.2026 — the Director: „Chcel by som mať všade možnosť vrátiť sa na predchádzajúcu obrazovku …
// hore máme šípku do lava a napísaný názov predchádzajúcej obrazovky.“ — „…pre všetky nové projekty“.
import { useEffect, useMemo, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Page, type PageWidth } from "nex-shared";

import { useFrame } from "../frame/FrameContext";
import { useKitT } from "../i18n";
import { TEMPLATE_PATHS } from "../manifest";
import { useNavHistory } from "./navHistory";

export interface KitPageProps {
  title: ReactNode;
  /** The screen's name for the back link of the next screen, when the title is not plain text. */
  crumb?: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  width?: PageWidth;
  children?: ReactNode;
}

/** „← <previous screen>“ — nothing on a screen that starts a walk. */
export function KitBackLink({ label }: { label: string }) {
  const t = useKitT();
  const { manifest } = useFrame();
  const location = useLocation();
  const navigate = useNavigate();
  const { stack, visit } = useNavHistory();
  const path = `${location.pathname}${location.search}`;
  const starts = useMemo(
    () => new Set<string>([...TEMPLATE_PATHS, ...manifest.nav.map((entry) => entry.path)]),
    [manifest.nav],
  );

  useEffect(() => {
    visit({ pathname: location.pathname, path, label }, starts.has(location.pathname));
  }, [location.pathname, path, label, starts, visit]);

  const at = stack.findIndex((s) => s.pathname === location.pathname);
  const previous = at > 0 ? stack[at - 1] : null;
  if (!previous) return null;
  return (
    <button
      type="button"
      onClick={() => navigate(previous.path)}
      className="mb-2 flex items-center gap-1 text-sm text-[var(--color-accent,#2563eb)] hover:underline"
      aria-label={t("kit.back.to", { screen: previous.label })}
    >
      <span aria-hidden="true">←</span>
      <span>{previous.label}</span>
    </button>
  );
}

export function KitPage({ title, crumb, subtitle, actions, width, children }: KitPageProps) {
  return (
    <>
      <KitBackLink label={crumb ?? (typeof title === "string" ? title : "")} />
      <Page title={title} subtitle={subtitle} actions={actions} width={width}>
        {children}
      </Page>
    </>
  );
}
