// „Prehľad“ — the app's own overview, the first page after signing in. Its texts come from the catalogs (src/locales,
// DEV-394), in the person's language.
import { Card, Page } from "nex-shared";
import { useKitT } from "nex-app-kit";

export function OverviewPage() {
  const t = useKitT();
  return (
    <Page title={t("kit.place.overview")}>
      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("app.overview.preparing")}</p>
      </Card>
    </Page>
  );
}
