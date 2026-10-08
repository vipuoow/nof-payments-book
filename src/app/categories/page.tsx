import Link from "next/link";
import { ChevronLeft } from "@/components/icons";
import { redirect } from "next/navigation";
import { ActionButton } from "@/components/action-button";
import { NameForm } from "@/components/categories/name-form";
import { loadCategories } from "@/ledger/queries";
import { loadMe } from "@/lib/session";
import {
  addCategoryAction, deleteCategoryAction, deleteRuleAction, renameCategoryAction, setHiddenAction,
} from "./actions";

export default async function CategoriesPage() {
  const { supabase, me } = await loadMe();
  if (!me.groupId) redirect("/");
  const [categories, rules] = await Promise.all([
    loadCategories(supabase),
    supabase.from("merchant_rules").select("id, merchant_pattern, category_id").order("merchant_pattern"),
  ]);
  if (rules.error) throw rules.error;
  const defaults = categories.rows.filter((c) => c.group_id === null);
  const mine = categories.rows.filter((c) => c.group_id !== null);
  const section = "mt-6 mb-2 text-xs font-semibold text-muted";
  const list = "divide-y divide-line border-y border-line";

  return (
    <main className="mx-auto w-full max-w-[480px] px-4 pb-16">
      <header className="flex items-center justify-between py-3">
        <Link href="/" aria-label="홈" className="nav-icon"><ChevronLeft /></Link>
        <h1 className="font-semibold">카테고리</h1>
        <span className="w-8" />
      </header>

      <h2 className={section}>기본 카테고리</h2>
      <ul className={list}>
        {defaults.map((c) => {
          const hidden = categories.hiddenIds.has(c.id);
          return (
            <li key={c.id} data-testid={`default-${c.name}`} className="flex items-center justify-between py-3">
              <span className={hidden ? "text-muted" : ""}>{c.name}</span>
              <ActionButton action={setHiddenAction.bind(null, c.id, !hidden)} label={hidden ? "보이기" : "숨기기"} className="text-accent" />
            </li>
          );
        })}
      </ul>

      <h2 className={section}>우리 카테고리</h2>
      <ul className={list}>
        {mine.map((c) => (
          <li key={c.id} data-testid="group-category" className="flex items-start gap-3 py-3">
            <NameForm action={renameCategoryAction.bind(null, c.id)} label={`${c.name} 새 이름`} defaultName={c.name} button="저장" />
            <ActionButton
              action={deleteCategoryAction.bind(null, c.id)}
              label="삭제"
              confirmText="삭제하면 이 카테고리의 거래는 미지정이 되고, 관련 가맹점 규칙과 예산도 지워집니다."
              className="text-danger"
            />
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <NameForm action={addCategoryAction} label="새 카테고리 이름" button="추가" />
      </div>

      <h2 className={section}>가맹점 규칙</h2>
      {rules.data.length === 0 ? (
        <p className="py-3 text-sm text-muted">거래의 카테고리를 고르면 여기에 규칙이 생깁니다.</p>
      ) : (
        <ul className={list}>
          {rules.data.map((r) => (
            <li key={r.id} data-testid="rule" className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.merchant_pattern} → {categories.names.get(r.category_id) ?? ""}</span>
              <ActionButton action={deleteRuleAction.bind(null, r.id)} label="삭제" confirmText="이 규칙을 지울까요?" className="text-danger" />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
