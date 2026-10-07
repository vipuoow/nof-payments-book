import { describe, expect, it } from "vitest";
import { hashNonce, newNonce } from "./nonce";

describe("Google 로그인 nonce", () => {
  it("Google에 넘기는 값은 원래 값의 sha256(16진수)", () => {
    expect(hashNonce("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("매번 다른 원래 값을 만든다", () => {
    const a = newNonce();
    const b = newNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32,}$/);
  });
});
