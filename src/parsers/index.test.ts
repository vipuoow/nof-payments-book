import { describe, expect, it } from "vitest";
import { APPROVAL, NOT_KB } from "./__fixtures__/kb-card";
import { parseSms } from "./index";

const received = new Date("2026-09-23T08:27:00+09:00");

describe("parseSms", () => {
  it("맞는 분석기의 id와 결과를 돌려준다", () => {
    const { parserId, result } = parseSms(APPROVAL, received);
    expect(parserId).toBe("kb-card");
    expect(result.kind).toBe("approval");
  });

  it("맡을 분석기가 없으면 parserId null, unknown", () => {
    expect(parseSms(NOT_KB, received)).toEqual({ parserId: null, result: { kind: "unknown" } });
  });
});
