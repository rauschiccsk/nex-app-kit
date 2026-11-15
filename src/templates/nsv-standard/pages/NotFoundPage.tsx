// An address no page serves — said plainly, with the way back.
import { Link } from "react-router-dom";
import { Page } from "nex-shared";
import { useKitT } from "../../../i18n";

export function NotFoundPage() {
  const t = useKitT();
  return (
    <Page title={t("kit.notFound.title")} width="narrow">
      <p className="text-sm text-[var(--color-text-secondary)]">{t("kit.notFound.text")}</p>
      <Link to="/" className="mt-3 inline-block text-sm text-[var(--color-accent-primary)] hover:underline">
        {t("kit.notFound.back")}
      </Link>
    </Page>
  );
}
