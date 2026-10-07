import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MEDIA_FILES, mediaVersion, parseRange } from "./media";

describe("parseRange", () => {
  it("범위가 없으면 null(전체)", () => {
    expect(parseRange(null, 1000)).toBeNull();
  });
  it("bytes=0-99, bytes=100-, bytes=-50", () => {
    expect(parseRange("bytes=0-99", 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange("bytes=100-", 1000)).toEqual({ start: 100, end: 999 });
    expect(parseRange("bytes=-50", 1000)).toEqual({ start: 950, end: 999 });
  });
  it("끝이 파일보다 크면 파일 끝까지", () => {
    expect(parseRange("bytes=900-5000", 1000)).toEqual({ start: 900, end: 999 });
  });
  it("범위 밖이나 잘못된 형식은 invalid", () => {
    expect(parseRange("bytes=1000-1001", 1000)).toBe("invalid");
    expect(parseRange("bytes=50-10", 1000)).toBe("invalid");
    expect(parseRange("items=0-1", 1000)).toBe("invalid");
    expect(parseRange("bytes=0-1,5-6", 1000)).toBe("invalid");
    expect(parseRange("bytes=-0", 1000)).toBe("invalid");
  });
});

describe("mediaVersion", () => {
  it("파일 수정 시각을 버전으로, 없으면 null", async () => {
    const dir = mkdtempSync(join(tmpdir(), "media-"));
    expect(await mediaVersion(dir, "landing.mp4")).toBeNull();
    writeFileSync(join(dir, "landing.mp4"), "x");
    expect(await mediaVersion(dir, "landing.mp4")).toMatch(/^\d+$/);
  });
});

describe("MEDIA_FILES", () => {
  it("영상과 멈춘 그림 두 파일만 내보낸다", () => {
    expect(Object.keys(MEDIA_FILES).sort()).toEqual(["landing.jpg", "landing.mp4"]);
  });
});
