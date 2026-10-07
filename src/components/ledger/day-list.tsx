import Link from "next/link";
import { issuerLabel } from "@/ledger/issuer";
import { kstTime } from "@/ledger/month";
import { formatWon, type DayGroup } from "@/ledger/summary";

/** 날짜별 거래: 날짜 머리줄(그날 합계) + 흰 카드 목록. 줄 오른쪽은 금액과 그 아래 쓴 카드. */
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
    return <p className="py-12 text-center text-muted">이 달에는 거래가 없어요</p>;
  }
  return (
    <div className="mt-2">
      {groups.map((g) => (
        <section key={g.key}>
          <h2 className="tabular flex justify-between px-1 pb-2 pt-5 text-sm font-semibold text-muted">
            <span>{g.label}</span>
            {/* 월 합계와 같은 방식: 취소는 음수라 그대로 더한다 */}
            <span data-testid="day-total">{formatWon(g.items.reduce((sum, t) => sum + t.amount, 0))}원</span>
          </h2>
          <ul className="rounded-[20px] bg-surface py-1">
            {g.items.map((t) => {
              const category = t.categoryId ? categoryNames.get(t.categoryId) : undefined;
              const cancelled = cancelledIds.has(t.id);
              return (
                <li key={t.id}>
                  <Link data-testid="tx-row" href={`${base}&tx=${t.id}`} scroll={false} className="flex items-center gap-3 px-4 py-3 active:bg-background">
                    <span aria-hidden className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold ${category ? "bg-accent-soft text-accent" : "bg-background text-muted"}`}>
                      {category ? category.slice(0, 1) : "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{t.merchant}</span>
                      <span className="block truncate text-xs text-muted">
                        {category ?? "미지정"} · <span data-testid="tx-time" className="tabular">{kstTime(t.occurredAt)}</span>
                        {" · "}{memberNames.get(t.userId) ?? ""}{t.categorySource === "ai" ? " · 자동" : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className={`tabular font-semibold ${cancelled ? "text-muted line-through" : ""}`}>{formatWon(t.amount)}원</span>
                      <span data-testid="tx-card" className="text-xs text-muted">{issuerLabel(t.issuer ?? null, t.kind)}</span>
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
