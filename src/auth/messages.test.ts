import { describe, expect, it } from "vitest";
import { errorMessage, rpcErrorCode } from "./messages";

describe("messages", () => {
  it("알려진 코드는 한국어 문구, 모르는 코드는 기본 문구", () => {
    expect(errorMessage("invite_expired")).toContain("만료");
    expect(errorMessage("???")).toBe("문제가 발생했습니다. 다시 시도해 주세요.");
  });

  it("DB 예외 메시지가 알려진 코드일 때만 코드로 인정", () => {
    expect(rpcErrorCode({ message: "group_full" })).toBe("group_full");
    expect(rpcErrorCode({ message: "duplicate key value" })).toBeNull();
  });
});
