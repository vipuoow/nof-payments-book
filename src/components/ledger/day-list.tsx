import Link from "next/link";
import { formatWon, type DayGroup } from "@/ledger/summary";

export function DayList({
  groups, base, categoryNames, memberNames, cancelledIds,
}: {
  groups: DayGroup[];
  base: string;
  categoryNames: Map<string, string>;
  memberNames: Map<string, string>;
  cancelledIds: Set<string>;
}) {
  if (groups.length === 0) {
    return <p className="py-12 text-center text-muted">이 달에는 거래가 없습니다</p>;
  }
  return (
    <div className="mt-2">
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="pt-4 pb-1 text-xs font-semibold text-muted">{g.label}</h2>
          <ul className="divide-y divide-line border-y border-line">
            {g.items.map((t) => {
              const category = t.categoryId ? categoryNames.get(t.categoryId) : undefined;
              return (
                <li key={t.id}>
                  <Link data-testid="tx-row" href={`${base}&tx=${t.id}`} scroll={false} className="flex items-center gap-3 py-3 active:bg-surface">
                    <span className={`w-14 shrink-0 truncate text-sm ${category ? "" : "text-muted"}`}>{category ?? "미지정"}</span>
                    <span className="min-w-0 flex-1 truncate">{t.merchant}</span>
                    <span className="shrink-0 text-right">
                      <span className={`tabular block ${cancelledIds.has(t.id) ? "text-muted line-through" : ""}`}>
                        {formatWon(t.amount)}
                      </span>
                      <span className="block text-xs text-muted">
                        {memberNames.get(t.userId) ?? ""}{t.categorySource === "ai" ? " · 자동" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
