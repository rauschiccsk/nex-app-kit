// DEV-517 — nex-shared's DataTable with tight rows: cells keep readable text but the least vertical padding, and
// buttons, fields and selects in a cell are lowered too, so they do not stretch the row. NEX DualBook 0.1.0, Vizuál
// 26.11.2026 — the Director: „…riadky sú zbytočne široké berú veľa miesta, prosím zúžiť ich tak, aby bol text
// čitateľný ale aby riadok bol maximálne úzky…“ — „…pre všetky nové projekty“.
import type { ReactNode } from "react";
import { DataTable, type DataTableProps } from "nex-shared";

export const TIGHT_ROWS =
  "[&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-0.5 [&_td]:leading-tight [&_td_button]:py-0.5 [&_td_input]:py-0.5 [&_td_select]:py-0.5";

export function KitTable<Row>({ className = "", ...props }: DataTableProps<Row>) {
  return <DataTable {...props} className={`${TIGHT_ROWS} ${className}`.trim()} />;
}

export interface KitFieldsProps {
  rows: { label: ReactNode; value: ReactNode }[];
}

/** A label–value list of a document header or a summary, as tight as the table. */
export function KitFields({ rows }: KitFieldsProps) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 text-sm leading-tight sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-between gap-4 border-b border-[var(--color-border,#e5e7eb)] py-0.5">
          <dt className="text-[var(--color-text-secondary)]">{row.label}</dt>
          <dd className="text-right">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
