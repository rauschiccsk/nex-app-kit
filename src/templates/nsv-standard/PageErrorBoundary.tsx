// A page that crashes while it renders says so instead of leaving the window white (the cockpit's DEV-192). The
// boundary stands around the page's content, so the left panel and the top bar stay; moving to another page clears it.
import { Component, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useKitT } from "../../i18n";

interface State {
  error: Error | null;
}

/** What a crashed page says — a function, so it reads the person's language (a class cannot use the hook). */
function Crashed({ message }: { message: string }) {
  const t = useKitT();
  return (
    <div role="alert" className="m-4 rounded-xl border border-[var(--color-state-error-fg)]/40 bg-[var(--color-state-error-bg)] p-4">
      <h2 className="text-sm font-semibold text-[var(--color-state-error-fg)]">{t("kit.error.title")}</h2>
      <p className="mt-2 text-sm text-[var(--color-text-primary)]">{t("kit.error.text")}</p>
      <p className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">{message}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-3 rounded-lg border border-[var(--color-border-default)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
      >
        {t("kit.error.reload")}
      </button>
    </div>
  );
}

class Boundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <Crashed message={error.message} />;
  }
}

export function PageErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <Boundary key={pathname}>{children}</Boundary>;
}
