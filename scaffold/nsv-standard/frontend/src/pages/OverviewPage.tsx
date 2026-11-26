// „Prehľad“ — the app's own overview, the first page after signing in. Its texts come from the catalogs (src/locales,
// DEV-394), in the person's language.
import { Card } from "nex-shared";
import { KitPage, useKitT } from "nex-app-kit";

// Every screen is a KitPage (DEV-517): opened from another screen it gets „← <previous screen>“ above its title; tables
// are KitTable and label–value lists KitFields — tight rows, as every app on the template has them.
export function OverviewPage() {
  const t = useKitT();
  return (
    <KitPage title={t("kit.place.overview")}>
      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]">{t("app.overview.preparing")}</p>
      </Card>
    </KitPage>
  );
}
