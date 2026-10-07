import { stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * 처음 화면 배경 영상과 멈춘 그림. NAS 폴더(media/)에 넣어 두고 파일만 바꾸면 교체된다(설계 5).
 * 정해진 두 이름만 내보내서 경로를 바꿔 다른 파일을 읽는 일을 막는다.
 */
export const MEDIA_FILES: Record<string, string> = {
  "landing.mp4": "video/mp4",
  "landing.jpg": "image/jpeg",
};

/** 영상 폴더: 운영(NAS 묶음)은 /app/media, 로컬은 MEDIA_DIR로 바꾼다 */
export function mediaDir(): string {
  return process.env.MEDIA_DIR || join(process.cwd(), "media");
}

/** 파일 수정 시각(ms)을 버전으로 쓴다. 주소 뒤에 붙여 파일을 바꾸면 휴대폰이 새로 받게 한다. 없으면 null */
export async function mediaVersion(dir: string, file: string): Promise<string | null> {
  try {
    return String(Math.floor((await stat(join(dir, file))).mtimeMs));
  } catch {
    return null;
  }
}

/** Range 머리값(한 구간만): 없으면 null, 잘못됐거나 파일 밖이면 invalid */
export function parseRange(header: string | null, size: number): { start: number; end: number } | "invalid" | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === "" && m[2] === "")) return "invalid";
  let start: number;
  let end: number;
  if (m[1] === "") {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}
