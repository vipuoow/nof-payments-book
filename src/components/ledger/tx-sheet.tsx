import Link from "next/link";
import { deleteTxAction } from "@/app/tx-actions";
import { ActionButton } from "@/components/action-button";
import { kstLocalValue } from "@/ledger/month";
import { formatWon, type LedgerTx, type Member } from "@/ledger/summary";
import { CategoryPicker } from "./category-picker";
import { TxEditForm } from "./tx-edit-form";

export function TxSheet({
  tx, rawBody, choices, members, closeHref,
}: { tx: LedgerTx; rawBody: string | null; choices: { id: string; name: string }[]; members: Member[]; closeHref: string }) {
  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-end">
      <Link href={closeHref} scroll={false} aria-label="닫기" className="absolute inset-0 bg-black/30" />
      <section role="dialog" aria-label="거래 수정" className="relative mx-auto max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-t-2xl bg-background p-4 pb-10">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="truncate font-semibold">{tx.merchant}</h2>
          <span className="tabular shrink-0">{formatWon(tx.amount)}원</span>
        </div>
        <CategoryPicker txId={tx.id} current={tx.categoryId} choices={choices} returnTo={closeHref} />
        <details className="mt-5">
          <summary className="cursor-pointer text-sm text-accent">더 보기</summary>
          <TxEditForm
            txId={tx.id} returnTo={closeHref} amount={tx.amount} merchant={tx.merchant}
            occurredAt={kstLocalValue(tx.occurredAt)} userId={tx.userId} memo={tx.memo} members={members}
          />
          {tx.kind === "manual" && (
            <div className="mt-4">
              <ActionButton
                action={deleteTxAction.bind(null, tx.id, closeHref)}
                label="삭제" confirmText="이 거래를 삭제할까요?" className="w-full py-3 text-danger"
              />
            </div>
          )}
          {rawBody && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-muted">원문 보기</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-surface p-3 font-sans">{rawBody}</pre>
            </details>
          )}
        </details>
      </section>
    </div>
  );
}
