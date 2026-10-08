import { describe, expect, it } from "vitest";
import { koWon, nextRawAmount } from "./won";

describe("koWon", () => {
  it("만·억 단위를 한글로 바꾸고 0인 단위는 뺀다", () => {
    expect(koWon(13325)).toBe("1만 3325");
    expect(koWon(133256)).toBe("13만 3256");
    expect(koWon(1332560)).toBe("133만 2560");
    expect(koWon(13325601)).toBe("1332만 5601");
    expect(koWon(123456789)).toBe("1억 2345만 6789");
    expect(koWon(100000)).toBe("10만");
    expect(koWon(100000005)).toBe("1억 5");
    expect(koWon(900)).toBe("900");
  });

  it("0이나 숫자가 아니면 빈 글자", () => {
    expect(koWon(0)).toBe("");
    expect(koWon(Number.NaN)).toBe("");
    expect(koWon("")).toBe("");
    expect(koWon("12000")).toBe("1만 2000");
  });
});

describe("nextRawAmount", () => {
  it("화면 글자가 아니라 실제 숫자 뒤에 붙인다: 10만 뒤에 5를 누르면 100005", () => {
    expect(nextRawAmount("10000", "insertText", "5")).toBe("100005");
  });
  it("지우기는 마지막 숫자 하나, 잘라내기는 전부", () => {
    expect(nextRawAmount("13325", "deleteContentBackward", null)).toBe("1332");
    expect(nextRawAmount("13325", "deleteByCut", null)).toBe("");
  });
  it("붙여넣기는 숫자만 받고, 앞의 0은 없애고, 11자리까지", () => {
    expect(nextRawAmount("", "insertFromPaste", "12,300원")).toBe("12300");
    expect(nextRawAmount("", "insertText", "0")).toBe("");
    expect(nextRawAmount("1234567890", "insertText", "12")).toBe("12345678901");
  });
  it("처리하지 않는 입력은 null", () => {
    expect(nextRawAmount("12", "historyUndo", null)).toBeNull();
  });
});

describe("rawFromEdit (beforeinput을 막을 수 없는 안드로이드 키보드)", () => {
  it("화면 글자가 바뀐 만큼만 실제 숫자에 반영한다", async () => {
    const { rawFromEdit } = await import("./won");
    expect(rawFromEdit("100000", "10만5")).toBe("1000005"); // 숫자 하나 붙임
    expect(rawFromEdit("100000", "10")).toBe("10000"); // "만"을 지움 → 숫자 하나 지움
    expect(rawFromEdit("13325", "1만 332")).toBe("1332");
    expect(rawFromEdit("", "12,300")).toBe("12300");
    expect(rawFromEdit("5", "")).toBe("");
    expect(rawFromEdit("100000", "0")).toBe(""); // 앞의 0은 없앤다
  });
});
