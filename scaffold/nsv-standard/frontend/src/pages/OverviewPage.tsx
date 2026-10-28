// Prehľad — the app's own overview, the first page after signing in.
import { Card, Page } from "nex-shared";

export function OverviewPage() {
  return (
    <Page title="Prehľad">
      <Card>
        <p className="text-sm text-[var(--color-text-secondary)]">Prehľad aplikácie sa pripravuje.</p>
      </Card>
    </Page>
  );
}
