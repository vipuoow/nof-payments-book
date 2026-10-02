import { describe, expect, it } from "vitest";
import { categoryOptions, pickCategory } from "./categorize";

describe("categoryOptions", () => {
  it("기본 카테고리에는 설명을 붙이고, 이름이 같으면 그룹 카테고리를 쓴다", () => {
    const options = categoryOptions([
      { id: "d-cafe", name: "카페", group_id: null },
      { id: "d-food", name: "식비", group_id: null },
      { id: "g-cafe", name: "카페", group_id: "g1" },
      { id: "g-pet", name: "반려동물", group_id: "g1" },
    ]);
    expect(options).toEqual([
      { id: "g-cafe", name: "카페", hint: "커피, 음료, 디저트 카페" },
      { id: "d-food", name: "식비", hint: "음식점, 배달, 분식, 반찬 등 식사" },
      { id: "g-pet", name: "반려동물", hint: null },
    ]);
  });

  it("그룹 카테고리가 기본보다 먼저 와도 그룹 것을 쓴다", () => {
    const options = categoryOptions([
      { id: "g-cafe", name: "카페", group_id: "g1" },
      { id: "d-cafe", name: "카페", group_id: null },
    ]);
    expect(options.map((o) => o.id)).toEqual(["g-cafe"]);
  });
});

describe("pickCategory", () => {
  const options = [
    { id: "c-cafe", name: "카페", hint: null },
    { id: "c-etc", name: "기타", hint: null },
  ];

  it("확신이 기준 이상이면 카테고리 id", () => {
    expect(pickCategory({ name: "카페", confidence: 0.7 }, options, 0.7)).toBe("c-cafe");
  });

  it("확신이 기준 미만이면 null", () => {
    expect(pickCategory({ name: "카페", confidence: 0.69 }, options, 0.7)).toBeNull();
  });

  it("기타를 고르면 null", () => {
    expect(pickCategory({ name: "기타", confidence: 0.99 }, options, 0.7)).toBeNull();
  });

  it("선택지에 없는 이름이거나 답이 없으면 null", () => {
    expect(pickCategory({ name: "여행", confidence: 0.99 }, options, 0.7)).toBeNull();
    expect(pickCategory(null, options, 0.7)).toBeNull();
  });
});
