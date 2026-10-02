import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryClassifier, CategoryOption, ClassifyAnswer } from "./typesafe";

export type CategoryRow = { id: string; name: string; group_id: string | null };
export type CategorizeOutcome = "categorized" | "undecided" | "skipped";

/** 기본 카테고리 설명. jev가 고를 때 참고한다. */
const CATEGORY_HINTS: Record<string, string> = {
  식비: "음식점, 배달, 분식, 반찬 등 식사",
  카페: "커피, 음료, 디저트 카페",
  편의점: "편의점",
  교통: "택시, 대중교통, 주유, 주차, 톨게이트",
  쇼핑: "온라인몰, 의류, 전자제품, 백화점 등 물건 구매",
  생활: "마트 장보기, 생활용품, 공과금, 통신비, 관리비",
  의료: "병원, 약국, 치과",
  문화: "영화, 공연, 책, 여가, 취미",
  기타: "위에 해당하지 않음",
};

/** jev가 골라도 미지정으로 두는 카테고리. 사실상 '모르겠다'는 뜻이라 사용자가 고르게 한다. */
const UNDECIDED_NAMES = new Set(["기타"]);

/** 선택지: 이름이 같으면 그룹 카테고리를 쓴다(jev 선택지 이름은 겹치면 안 된다). */
export function categoryOptions(rows: CategoryRow[]): CategoryOption[] {
  const byName = new Map<string, CategoryOption>();
  for (const row of rows) {
    if (byName.has(row.name) && row.group_id === null) continue;
    byName.set(row.name, { id: row.id, name: row.name, hint: CATEGORY_HINTS[row.name] ?? null });
  }
  return [...byName.values()];
}

/** jev 답을 카테고리 id로 바꾼다. 확신이 낮거나 '기타'·모르는 이름이면 null(미지정). */
export function pickCategory(
  answer: ClassifyAnswer | null,
  options: CategoryOption[],
  minConfidence: number,
): string | null {
  if (!answer || answer.confidence < minConfidence || UNDECIDED_NAMES.has(answer.name)) return null;
  return options.find((o) => o.name === answer.name)?.id ?? null;
}

/**
 * 카테고리가 비어 있는 결제·취소 거래를 jev로 분류해 저장한다.
 * 그 사이 사용자가 카테고리를 넣었으면 덮어쓰지 않는다. DB 오류만 던진다.
 */
export async function categorizeTransaction(
  db: SupabaseClient,
  classify: CategoryClassifier,
  transactionId: string,
): Promise<CategorizeOutcome> {
  const { data: tx, error } = await db
    .from("transactions")
    .select("group_id, kind, merchant, category_id")
    .eq("id", transactionId)
    .single();
  if (error) throw error;
  if (tx.category_id || tx.kind === "manual") return "skipped";

  const [categories, hidden, setting] = await Promise.all([
    db.from("categories").select("id, name, group_id")
      .or(`group_id.is.null,group_id.eq.${tx.group_id}`)
      .order("sort_order"),
    db.from("category_hidden").select("category_id").eq("group_id", tx.group_id),
    db.from("app_settings").select("value").eq("key", "category_ai_min_confidence").single(),
  ]);
  if (categories.error) throw categories.error;
  if (hidden.error) throw hidden.error;
  if (setting.error) throw setting.error;

  // 그룹이 숨긴 기본 카테고리는 고르지 않는다
  const hiddenIds = new Set(hidden.data.map((h) => h.category_id));
  const options = categoryOptions(categories.data.filter((c) => !hiddenIds.has(c.id)));
  const categoryId = pickCategory(await classify(tx.merchant, options), options, Number(setting.data.value));
  if (!categoryId) return "undecided";

  const { data: updated, error: updateError } = await db
    .from("transactions")
    .update({ category_id: categoryId, category_source: "ai" })
    .eq("id", transactionId)
    .is("category_id", null)
    .select("id");
  if (updateError) throw updateError;
  if (updated.length === 0) return "skipped";

  // 이 결제에 연결된 취소가 미지정이면 같은 카테고리로 맞춰 카테고리별 합계가 상쇄되게 한다
  const { error: cancelError } = await db
    .from("transactions")
    .update({ category_id: categoryId, category_source: "ai" })
    .eq("cancels_transaction_id", transactionId)
    .is("category_id", null);
  if (cancelError) throw cancelError;
  return "categorized";
}
