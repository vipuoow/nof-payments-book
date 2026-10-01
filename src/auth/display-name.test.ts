import { describe, expect, it } from "vitest";
import { defaultDisplayName } from "./display-name";

describe("defaultDisplayName", () => {
  it("Google 이름(full_name → name) 순으로 쓴다", () => {
    expect(defaultDisplayName({ email: "a@gmail.com", user_metadata: { full_name: " 홍길동 ", name: "길동" } })).toBe("홍길동");
    expect(defaultDisplayName({ email: "a@gmail.com", user_metadata: { name: "길동" } })).toBe("길동");
  });

  it("이름이 없으면 이메일 앞부분", () => {
    expect(defaultDisplayName({ email: "gildong@gmail.com", user_metadata: {} })).toBe("gildong");
    expect(defaultDisplayName({ email: null })).toBe("");
  });
});
