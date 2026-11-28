// DEV-535 — Sprievodca from any screen: its button in the top bar opens the panel with the conversation beside the
// screen the person is on, so they need not leave their work; „Ako urobiť“ in the left panel holds the same
// conversation on a page of its own. The Director 28.11.2026: „Toto by fungovalo aj na začiatku aj počas práce a aj na
// konci.“
import { useEffect } from "react";
import { Page } from "nex-shared";

import { useFrame } from "../frame/FrameContext";
import { useKitT } from "../i18n";
import { GuideChat } from "./GuideChat";
import { GuideRunner } from "./GuideRunner";
import { useGuide } from "./store";

/** The button in the top bar. */
export function GuideButton() {
  const t = useKitT();
  const open = useGuide((s) => s.open);
  const setOpen = useGuide((s) => s.setOpen);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className="rounded-lg px-2 py-1 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted,#f3f4f6)]"
    >
      🧭 {t("kit.guiding.name")}
    </button>
  );
}

/** The panel and the guiding card, for the person signed in — what Sprievodca keeps in the browser is theirs only. */
export function GuideLayer() {
  const t = useKitT();
  const { user } = useFrame();
  const open = useGuide((s) => s.open);
  const setOpen = useGuide((s) => s.setOpen);
  const setOwner = useGuide((s) => s.setOwner);
  const guiding = useGuide((s) => s.phase === "guiding");

  useEffect(() => setOwner(user?.username ?? null), [user?.username, setOwner]);

  return (
    <>
      {open && !guiding && (
        <aside
          aria-label={t("kit.guiding.name")}
          className="fixed bottom-0 right-0 top-12 z-40 flex w-[26rem] max-w-full flex-col gap-3 overflow-y-auto border-l border-[var(--color-border-default)] bg-[var(--color-surface)] p-4 shadow-xl"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">🧭 {t("kit.guiding.name")}</h2>
            <button type="button" className="text-sm underline" onClick={() => setOpen(false)}>
              {t("kit.guiding.close")}
            </button>
          </div>
          <GuideChat />
        </aside>
      )}
      <GuideRunner />
    </>
  );
}

/** „Ako urobiť“ — the conversation on a page of its own, in place of „Ako začať“. */
export function HowToPage() {
  const t = useKitT();
  return (
    <Page title={t("kit.place.howTo")} width="narrow">
      <GuideChat />
    </Page>
  );
}
