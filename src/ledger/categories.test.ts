import { describe, expect, it } from "vitest";
import { validateCategoryName } from "./categories";

describe("validateCategoryName", () => {
  const taken = ["식비", "카페", "육아"];
  it("앞뒤 공백을 지우고 받아들인다", () => {
    expect(validateCategoryName("  반려동물 ", taken)).toEqual({ ok: true, name: "반려동물" });
  });
  it("빈칸·20자 초과·이미 있는 이름은 막는다", () => {
    expect(validateCategoryName("   ", taken)).toEqual({ ok: false, error: "이름을 입력해 주세요." });
    expect(validateCategoryName("가".repeat(21), taken)).toEqual({ ok: false, error: "이름은 20자까지 입력할 수 있습니다." });
    expect(validateCategoryName("가".repeat(20), taken)).toMatchObject({ ok: true });
    expect(validateCategoryName("카페", taken)).toEqual({ ok: false, error: "이미 있는 이름입니다." });
    expect(validateCategoryName(" 육아", taken)).toEqual({ ok: false, error: "이미 있는 이름입니다." });
  });
});
