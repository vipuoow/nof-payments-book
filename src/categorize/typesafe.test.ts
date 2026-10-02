import { describe, expect, it, vi } from "vitest";
import { createTypesafeClassifier, type CategoryOption } from "./typesafe";

const options: CategoryOption[] = [
  { id: "c1", name: "카페", hint: "커피, 음료, 디저트 카페" },
  { id: "c2", name: "식비", hint: "음식점, 배달" },
  { id: "c3", name: "반려동물", hint: null },
];

const okResponse = (choice: string, confidence: number) =>
  new Response(JSON.stringify({
    model: "jev-1.13.0",
    answers: { category: { type: "choice", choice, confidence, probabilities: { [choice]: 1 } } },
    usage: { input_tokens: 300, output_tokens: 80 },
  }), { status: 200 });

describe("createTypesafeClassifier", () => {
  it("가맹점 이름과 카테고리만 Choice 질문으로 보내고 답을 돌려준다", async () => {
    const fetch = vi.fn(async () => okResponse("카페", 0.98));
    const classify = createTypesafeClassifier({ apiKey: "test-key", fetch });

    expect(await classify("테스트커피 강남역점(메가", options)).toEqual({ name: "카페", confidence: 0.98 });

    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer test-key");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("jev-latest");
    expect(body.questions.category.type).toBe("choice");
    expect(body.questions.category.instructions.merchant).toBe("테스트커피 강남역점(메가");
    expect(body.questions.category.criteria).toEqual({
      카페: "커피, 음료, 디저트 카페", 식비: "음식점, 배달", 반려동물: null,
    });
    // 금액·사람·날짜는 보내지 않는다
    expect(JSON.stringify(body)).not.toMatch(/12,?300|홍|09\/23/);
  });

  it("선택지가 2개 미만이면 호출하지 않고 null", async () => {
    const fetch = vi.fn(async () => okResponse("카페", 1));
    const classify = createTypesafeClassifier({ apiKey: "k", fetch });
    expect(await classify("가게", options.slice(0, 1))).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("응답 코드가 200이 아니면 null", async () => {
    const classify = createTypesafeClassifier({ apiKey: "k", fetch: async () => new Response("{}", { status: 401 }) });
    expect(await classify("가게", options)).toBeNull();
  });

  it("응답 형식이 다르면 null", async () => {
    const classify = createTypesafeClassifier({
      apiKey: "k", fetch: async () => new Response(JSON.stringify({ answers: {} }), { status: 200 }),
    });
    expect(await classify("가게", options)).toBeNull();
  });

  it("네트워크 오류면 null", async () => {
    const classify = createTypesafeClassifier({ apiKey: "k", fetch: async () => { throw new TypeError("fetch failed"); } });
    expect(await classify("가게", options)).toBeNull();
  });

  it("시간 초과면 기다리지 않고 null", async () => {
    const hang: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason));
      });
    const classify = createTypesafeClassifier({ apiKey: "k", fetch: hang, timeoutMs: 20 });
    const started = Date.now();
    expect(await classify("가게", options)).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
