// The first page of the person signed in to the web — the app's own; the web's agent builds it.
import { useKitT, useWebAccount } from "nex-app-kit";

export function HomePage() {
  const t = useKitT();
  const { account } = useWebAccount();
  return (
    <section>
      <h1 className="mb-2 text-lg font-semibold">{t("app.web.home.title")}</h1>
      <p className="text-sm text-[var(--color-text-secondary)]">{t("app.web.home.preparing", { email: account.email })}</p>
    </section>
  );
}
