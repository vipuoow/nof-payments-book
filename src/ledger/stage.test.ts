import { describe, expect, it } from "vitest";
import { homeStage } from "./stage";

describe("homeStage", () => {
  it("아무도 연결 전이면 연결 단계(한도가 있어도)", () => {
    expect(homeStage({ anyConnected: false, hasTotalLimit: false })).toBe("connect");
    expect(homeStage({ anyConnected: false, hasTotalLimit: true })).toBe("connect");
  });
  it("한 명이라도 연결됐고 한도가 없으면 한도 단계", () => {
    expect(homeStage({ anyConnected: true, hasTotalLimit: false })).toBe("limit");
  });
  it("연결됐고 한도가 있으면 평소 홈", () => {
    expect(homeStage({ anyConnected: true, hasTotalLimit: true })).toBe("home");
  });
});
