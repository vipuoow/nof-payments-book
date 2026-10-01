import { describe, expect, it } from "vitest";
import { randomToken, sha256Hex } from "./hash";

describe("sha256Hex", () => {
  it("알려진 값의 SHA-256 hex를 돌려준다", () => {
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("한글도 UTF-8로 해시한다", () => {
    expect(sha256Hex("국민")).toHaveLength(64);
    expect(sha256Hex("국민")).not.toBe(sha256Hex("국 민"));
  });
});

describe("randomToken", () => {
  it("32바이트 base64url(43자)이며 매번 다르다", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });
});
