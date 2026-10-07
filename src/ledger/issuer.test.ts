import { describe, expect, it } from "vitest";
import { issuerLabel } from "./issuer";

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
});
