import Link from "next/link";
import { redirect } from "next/navigation";
import { TxForm } from "@/components/ledger/tx-form";
import { isUuid } from "@/ledger/forms";
import { kstLocalValue } from "@/ledger/month";
import { loadCategories, loadMembers, loadRawMessage } from "@/ledger/queries";
import { loadMe } from "@/lib/session";

export default async function NewTxPage({ searchParams }: PageProps<"/new">) {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const sp = await searchParams;
  const [members, categories, raw] = await Promise.all([
    loadMembers(supabase, me.groupId),
    loadCategories(supabase),
    isUuid(sp.raw) ? loadRawMessage(supabase, sp.raw) : null,
  ]);

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" className="text-accent">취소</Link>
        <h1 className="font-semibold">직접 입력</h1>
        <span className="w-8" />
      </header>
      {raw && (
        <pre className="mb-4 whitespace-pre-wrap rounded-xl bg-surface p-3 font-sans text-sm">{raw.body}</pre>
      )}
      <TxForm
        members={members}
        choices={categories.choices}
        defaultUserId={raw?.userId ?? me.userId}
        defaultOccurredAt={kstLocalValue(raw?.receivedAt ?? new Date())}
        rawId={raw?.id ?? null}
      />
    </main>
  );
}
