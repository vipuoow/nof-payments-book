export type Sent = "shared" | "copied" | "manual" | "retry";

/**
 * 초대 링크 보내기: 휴대폰 공유 창 → (없으면) 클립보드 → (막히면) 직접 복사 안내.
 * 휴대폰은 버튼을 누른 직후에만 공유 창을 열어 주므로, fromClick이 아니면 막힌 공유 창은 버튼으로 다시 시도하게 한다.
 */
export async function deliver(text: string, fromClick: boolean): Promise<Sent> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      // 사용자가 닫았거나(AbortError), 버튼을 누른 직후가 아니라 막힌 경우
      if (!fromClick || (e as Error).name === "AbortError") return "retry";
    }
  }
  return copyText(text);
}

/** 클립보드에 복사. 막히면 manual(화면에 글자를 보여 주고 길게 눌러 복사하게 한다) */
export async function copyText(text: string): Promise<"copied" | "manual"> {
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "manual";
  }
}
