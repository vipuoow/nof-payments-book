import { describe, expect, it } from "vitest";
import { findOverlap, type OverlapRow } from "./overlap";

const at = (hhmm: string) => new Date(`2026-10-08T${hhmm}:00+09:00`);
const row = (o: Partial<OverlapRow>): OverlapRow =>
  ({ userId: "u1", kind: "approval", amount: 4500, merchant: "스타벅스", occurredAt: at("14:05"), ...o });
const target = { userId: "u1", amount: 4500, occurredAt: at("14:08") };

describe("findOverlap (붙여넣기 겹침)", () => {
  it("같은 사람·금액, 앞뒤 5분 안이면 겹친다(경계 포함)", () => {
    expect(findOverlap([row({})], target)?.merchant).toBe("스타벅스");
    expect(findOverlap([row({ occurredAt: at("14:03") })], target)).not.toBeNull(); // 5분
    expect(findOverlap([row({ occurredAt: at("14:13") })], target)).not.toBeNull(); // 5분
    expect(findOverlap([row({ occurredAt: at("14:02") })], target)).toBeNull(); // 6분
  });
  it("다른 사람·다른 금액·취소는 겹치지 않는다. 직접 추가끼리는 겹친다", () => {
    expect(findOverlap([row({ userId: "u2" })], target)).toBeNull();
    expect(findOverlap([row({ amount: 4600 })], target)).toBeNull();
    expect(findOverlap([row({ kind: "cancel", amount: -4500 })], target)).toBeNull();
    expect(findOverlap([row({ kind: "manual" })], target)).not.toBeNull();
  });
});
