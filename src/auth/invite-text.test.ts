import { describe, expect, it } from "vitest";
import { inviteShareText } from "./invite-text";

describe("inviteShareText", () => {
  it("초대한 사람, 만료일(KST), 링크를 넣는다", () => {
    // 2026-10-14 15:30 UTC = 10월 15일 00:30 KST
    expect(inviteShareText("남편", "2026-10-14T15:30:00Z", "https://ledger.example/invite/abc")).toBe(
      "남편님이 같이가계부에 초대했어요. 아래 링크로 가입해 주세요(10월 15일까지).\nhttps://ledger.example/invite/abc",
    );
  });

  it("닉네임의 기호·이모지를 그대로 둔다", () => {
    expect(inviteShareText("곰돌이🐻, 1호", "2026-01-01T00:00:00Z", "u")).toMatch(/^곰돌이🐻, 1호님이 /);
  });
});
