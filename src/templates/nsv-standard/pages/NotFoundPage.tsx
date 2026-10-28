// An address no page serves — said plainly, with the way back.
import { Link } from "react-router-dom";
import { Page } from "nex-shared";

export function NotFoundPage() {
  return (
    <Page title="Stránka neexistuje" width="narrow">
      <p className="text-sm text-[var(--color-text-secondary)]">
        Na tejto adrese nič nie je. Možno sa zmenila, alebo bola zle napísaná.
      </p>
      <Link to="/" className="mt-3 inline-block text-sm text-[var(--color-accent-primary)] hover:underline">
        Späť na Prehľad
      </Link>
    </Page>
  );
}
