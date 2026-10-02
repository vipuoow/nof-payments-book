/** 그룹 카테고리 이름: 앞뒤 공백 제거, 1~20자, 이미 쓰는 이름(기본 + 그룹)과 겹치면 안 된다. */
export function validateCategoryName(raw: string, taken: string[]): { ok: true; name: string } | { ok: false; error: string } {
  const name = raw.trim();
  if (!name) return { ok: false, error: "이름을 입력해 주세요." };
  if ([...name].length > 20) return { ok: false, error: "이름은 20자까지 입력할 수 있습니다." };
  if (taken.includes(name)) return { ok: false, error: "이미 있는 이름입니다." };
  return { ok: true, name };
}
