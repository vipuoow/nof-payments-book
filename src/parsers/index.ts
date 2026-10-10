import { hyundaiCardParser } from "./hyundai-card";
import { kbCardParser } from "./kb-card";
import type { CardSmsParser, ParseResult } from "./types";

export type { CardSmsParser, ParseResult, Payment } from "./types";

// 카드사를 추가할 때는 분석기 파일과 픽스처 테스트를 만들고 여기에 등록한다.
export const PARSERS: readonly CardSmsParser[] = [kbCardParser, hyundaiCardParser];

export function parseSms(body: string, receivedAt: Date): { parserId: string | null; result: ParseResult } {
  const parser = PARSERS.find((p) => p.canParse(body));
  if (!parser) return { parserId: null, result: { kind: "unknown" } };
  return { parserId: parser.id, result: parser.parse(body, receivedAt) };
}
