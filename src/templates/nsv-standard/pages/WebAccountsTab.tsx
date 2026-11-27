// DEV-523 — Nastavenia → Kontá webu of an app with a web (web/): the web's own accounts, signed in by e-mail. A
// registration is a request: the admin approves or rejects it here; an active account can be switched off and on.
// 26.11.2026 orthodox-register: the priests use the web, the administrator decides who gets in. The Director on the
// proposal: „Súhlasím“; 03.11.2026: „…každú požiadavku na registráciu musí schváliť človek - administrátor.“
import { useEffect, useMemo, useState } from "react";
import { Button, Card, StatusBadge, announceSaved, type DataTableColumn } from "nex-shared";

import { useFrame } from "../../../frame/FrameContext";
import { errorText } from "../../../frame/people";
import { useKitT } from "../../../i18n";
import type { WebAccountAction, WebAccountRead, WebAccountStatus } from "../../../standard-api";
import { KitTable } from "../../../screens/KitTable";

const BADGE: Record<WebAccountStatus, "warning" | "success" | "error" | "neutral"> = {
  pending: "warning",
  active: "success",
  rejected: "error",
  disabled: "neutral",
};

/** What the admin may do with an account in each state — the server allows exactly these (KONTRAKT.md → Web). */
const ACTIONS: Record<WebAccountStatus, WebAccountAction[]> = {
  pending: ["approve", "reject"],
  active: ["disable"],
  rejected: [],
  disabled: ["enable"],
};

function fullName(account: WebAccountRead): string {
  return [account.first_name, account.last_name].filter(Boolean).join(" ") || "—";
}

export function WebAccountsTab() {
  const t = useKitT();
  const { api } = useFrame();
  const [accounts, setAccounts] = useState<WebAccountRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api
      .listWebAccounts()
      .then(setAccounts)
      .catch((e: unknown) => setError(errorText(e, t("kit.web.accounts.loadFailed"))))
      .finally(() => setLoading(false));
  }, [api, t]);

  // The requests that wait for the admin first, then by when they came.
  const rows = useMemo(
    () => [...accounts].sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending")),
    [accounts],
  );
  const waiting = accounts.filter((a) => a.status === "pending").length;

  async function act(account: WebAccountRead, action: WebAccountAction) {
    setBusy(account.id);
    setError("");
    try {
      const changed = await api.decideWebAccount(account.id, action);
      setAccounts((prev) => prev.map((a) => (a.id === changed.id ? changed : a)));
      announceSaved();
    } catch (e: unknown) {
      setError(errorText(e, t("kit.web.accounts.actionFailed")));
    } finally {
      setBusy(null);
    }
  }

  const columns: DataTableColumn<WebAccountRead>[] = [
    { key: "name", header: t("kit.web.accounts.name"), render: (a) => fullName(a) },
    { key: "email", header: t("kit.web.accounts.email"), render: (a) => a.email },
    {
      key: "status",
      header: t("kit.web.accounts.status"),
      render: (a) => (
        <StatusBadge status={BADGE[a.status]} pulse={a.status === "pending"}>
          {t(`kit.web.status.${a.status}`)}
        </StatusBadge>
      ),
    },
    {
      key: "requested",
      header: t("kit.web.accounts.requested"),
      render: (a) => (a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"),
    },
  ];

  return (
    <div className="p-6">
      <Card className="p-4">
        <p className="mb-2 text-sm text-[var(--color-text-secondary)]">{t("kit.web.accounts.hint")}</p>
        {waiting > 0 && (
          <p className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
            {t("kit.web.accounts.waiting", { count: waiting })}
          </p>
        )}
        {error && <p className="mb-3 text-sm text-[var(--color-state-error-fg)]">{error}</p>}
        {!loading && (
          <KitTable
            columns={columns}
            rows={rows}
            getRowKey={(a) => a.id}
            emptyMessage={t("kit.web.accounts.empty")}
            rowActions={(a) => (
              <span className="flex justify-end gap-2">
                {ACTIONS[a.status].map((action) => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === "approve" || action === "enable" ? "primary" : "secondary"}
                    disabled={busy !== null}
                    onClick={() => void act(a, action)}
                  >
                    {t(`kit.web.action.${action}`)}
                  </Button>
                ))}
              </span>
            )}
          />
        )}
      </Card>
    </div>
  );
}
