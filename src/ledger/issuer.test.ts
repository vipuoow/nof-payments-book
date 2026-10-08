import { describe, expect, it } from "vitest";
import { issuerLabel, paidWithOf } from "./issuer";

describe("issuerLabel", () => {
  it("카드사 값을 화면 이름으로", () => {
    expect(issuerLabel("kb", "approval")).toBe("국민카드");
    expect(issuerLabel("hyundai", "cancel")).toBe("현대카드");
  });
  it("직접 입력은 카드사와 관계없이 직접 입력", () => {
    expect(issuerLabel(null, "manual")).toBe("직접 입력");
  });
  it("모르는 카드사나 빈 값은 카드", () => {
    expect(issuerLabel("shinhan", "approval")).toBe("카드");
    expect(issuerLabel(null, "approval")).toBe("카드");
  });
  it("온누리상품권으로 결제했다고 표시한 거래는 카드사와 관계없이 온누리상품권", () => {
    expect(issuerLabel("kb", "approval", "onnuri")).toBe("온누리상품권");
    expect(issuerLabel(null, "manual", "onnuri")).toBe("온누리상품권");
    expect(issuerLabel("kb", "approval", null)).toBe("국민카드");
  });
});

describe("paidWithOf", () => {
  it("취소 줄은 원래 결제의 온누리 표시를 따른다", () => {
    const approval = { id: "a", kind: "approval", paidWith: "onnuri", cancelsTransactionId: null };
    const cancel = { id: "c", kind: "cancel", paidWith: null, cancelsTransactionId: "a" };
    const byId = new Map([[approval.id, approval]]);
    expect(paidWithOf(cancel, byId)).toBe("onnuri");
    expect(paidWithOf(approval, byId)).toBe("onnuri");
    expect(paidWithOf({ ...cancel, cancelsTransactionId: "zzz" }, byId)).toBeNull();
  });
});
