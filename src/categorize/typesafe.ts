import { z } from "zod";

export type CategoryOption = { id: string; name: string; hint: string | null };
export type ClassifyAnswer = { name: string; confidence: number };
/** 가맹점 이름으로 카테고리 하나를 고른다. 실패하면 null(예외를 던지지 않는다). */
export type CategoryClassifier = (merchant: string, options: CategoryOption[]) => Promise<ClassifyAnswer | null>;

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const STATE = "한국 신용카드 결제 문자에서 뽑은 가맹점 이름이다. 문자 길이 제한으로 이름 끝이 잘려 있을 수 있다.";
const QUESTION = "`merchant` 가맹점에서 결제했다면 가계부의 어느 카테고리에 해당하나?";

const Answer = z.object({
  answers: z.object({
    category: z.object({ choice: z.string(), confidence: z.number() }),
  }),
});

/**
 * TypeSafe(jev) Choice 질문으로 가맹점 카테고리를 고른다.
 * 가맹점 이름과 카테고리 이름·설명만 보낸다. 키와 가맹점 이름은 로그에 남기지 않는다.
 */
export function createTypesafeClassifier(opts: {
  apiKey: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}): CategoryClassifier {
  const doFetch = opts.fetch ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 5000;

  return async (merchant, options) => {
    if (options.length < 2) return null;
    try {
      const res = await doFetch(ENDPOINT, {
        method: "POST",
        headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: "jev-latest",
          state: STATE,
          questions: {
            category: {
              type: "choice",
              instructions: { merchant, question: QUESTION },
              criteria: Object.fromEntries(options.map((o) => [o.name, o.hint])),
            },
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        console.warn(`[categorize] TypeSafe 응답 ${res.status}`);
        return null;
      }
      const parsed = Answer.safeParse(await res.json());
      if (!parsed.success) {
        console.warn("[categorize] TypeSafe 응답 형식이 다릅니다");
        return null;
      }
      const { choice, confidence } = parsed.data.answers.category;
      return { name: choice, confidence };
    } catch (e) {
      console.warn(`[categorize] TypeSafe 호출 실패: ${(e as Error).name}`);
      return null;
    }
  };
}
