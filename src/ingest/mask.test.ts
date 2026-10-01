import { describe, expect, it } from "vitest";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { maskBody } from "./mask";

describe("maskBody", () => {
  it("카드번호 끝자리를 가린다", () => {
    expect(maskBody(APPROVAL)).toContain("KB국민카드****승인");
    expect(maskBody(APPROVAL)).not.toContain("1234");
  });

  it("다른 내용은 그대로 둔다", () => {
    expect(maskBody(APPROVAL).replace("****", "1234")).toBe(APPROVAL);
  });
});
