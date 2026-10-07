/**
 * 처음 홈 단계(설계 4.6): 아무도 휴대폰 연결 전이면 연결 → 한 명이라도 연결됐고 한도가 없으면 한도 정하기 → 평소 홈.
 * 한도는 건너뛸 수 없다.
 */
export type HomeStage = "connect" | "limit" | "home";

export function homeStage(s: { anyConnected: boolean; hasTotalLimit: boolean }): HomeStage {
  if (!s.anyConnected) return "connect";
  if (!s.hasTotalLimit) return "limit";
  return "home";
}
