import { beforeAll, describe, expect, it, vi } from "vitest";
import type { CategoryClassifier } from "@/categorize/typesafe";
import { APPROVAL } from "@/parsers/__fixtures__/kb-card";
import { handleIngest, type IngestDeps } from "@/ingest/handler";
import { createRateLimiter } from "@/ingest/rate-limit";
import { adminClient, createGroupFixture, issueIngestToken, type GroupFixture } from "../helpers/db";

const SERVER_NOW = new Date("2026-09-23T09:00:00+09:00");
const deps = (tokenLimit = 30, ipLimit = 1000): IngestDeps => ({
  db: adminClient(),
  tokenLimiter: createRateLimiter({ limit: tokenLimit, windowMs: 60_000 }),
  ipLimiter: createRateLimiter({ limit: ipLimit, windowMs: 60_000 }),
  now: () => SERVER_NOW,
});

function post(body: unknown, token?: string, ip = "203.0.113.1"): Request {
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let g: GroupFixture;
let token: string;

beforeAll(async () => {
  g = await createGroupFixture("api");
  token = await issueIngestToken(g.owner.userId);
});

describe("POST /api/ingest", () => {
  it("정상 문자는 200 parsed", async () => {
    const res = await handleIngest(
      post({ body: APPROVAL, receivedAt: "2026-09-23T08:27:00+09:00", source: "ios_shortcut" }, token),
      deps(),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "parsed" });
  });

  it("receivedAt이 없으면 서버 수신 시각으로 저장한다", async () => {
    const body = APPROVAL.replace("09/23 08:26", "09/23 08:50");
    const res = await handleIngest(post({ body, source: "android_macrodroid" }, token), deps());
    expect(res.status).toBe(200);
    const { data } = await adminClient()
      .from("raw_messages").select("received_at").eq("group_id", g.groupId).eq("source", "android_macrodroid").single();
    expect(new Date(data!.received_at).toISOString()).toBe(SERVER_NOW.toISOString());
  });

  it("토큰이 없거나 틀리면 401", async () => {
    const ok = { body: APPROVAL, source: "ios_shortcut" };
    expect((await handleIngest(post(ok), deps())).status).toBe(401);
    expect((await handleIngest(post(ok, "wrong-token"), deps())).status).toBe(401);
  });

  it("JSON이 아니거나 형식이 틀리면 400", async () => {
    expect((await handleIngest(post("not json", token), deps())).status).toBe(400);
    expect((await handleIngest(post({ body: APPROVAL, source: "pager" }, token), deps())).status).toBe(400);
    expect(
      (await handleIngest(post({ body: APPROVAL, source: "ios_shortcut", receivedAt: "어제" }, token), deps())).status,
    ).toBe(400);
  });

  it("본문이 비어 있으면 연결 확인으로 보고 기록 없이 200 connected, 마지막 수신 시각은 갱신", async () => {
    const tg = await createGroupFixture("api-ping");
    const t = await issueIngestToken(tg.owner.userId);
    for (const body of ["", "   "]) {
      const res = await handleIngest(post({ body, source: "ios_shortcut" }, t), deps());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: "connected" });
    }
    const db = adminClient();
    const { count } = await db.from("raw_messages").select("id", { count: "exact", head: true }).eq("group_id", tg.groupId);
    expect(count).toBe(0);
    const { data } = await db.from("ingest_tokens").select("last_used_at").eq("user_id", tg.owner.userId).single();
    expect(new Date(data!.last_used_at).toISOString()).toBe(SERVER_NOW.toISOString());
    // 토큰이 틀리면 연결 확인도 401
    expect((await handleIngest(post({ body: "", source: "ios_shortcut" }, "wrong"), deps())).status).toBe(401);
  });

  it("가짜 토큰을 반복하는 IP는 토큰 확인 전에 429", async () => {
    const d = deps(30, 2);
    const fake = () => post({ body: APPROVAL, source: "ios_shortcut" }, `fake-${Math.random()}`, "198.51.100.7");
    expect((await handleIngest(fake(), d)).status).toBe(401);
    expect((await handleIngest(fake(), d)).status).toBe(401);
    expect((await handleIngest(fake(), d)).status).toBe(429);
    // 다른 IP의 정상 요청에는 영향이 없다
    expect((await handleIngest(post({ body: `${APPROVAL}\n#ip`, source: "manual_test" }, token), d)).status).toBe(200);
  });

  it("토큰당 제한을 넘으면 429", async () => {
    const d = deps(2);
    const req = () => post({ body: `${APPROVAL}\n#${Math.random()}`, source: "manual_test" }, token);
    expect((await handleIngest(req(), d)).status).toBe(200);
    expect((await handleIngest(req(), d)).status).toBe(200);
    expect((await handleIngest(req(), d)).status).toBe(429);
  });
});

describe("응답 후 자동 분류", () => {
  async function setup(label: string, classify: CategoryClassifier | null) {
    const group = await createGroupFixture(label);
    const t = await issueIngestToken(group.owner.userId);
    const tasks: Array<() => Promise<void>> = [];
    const d: IngestDeps = { ...deps(), classify, afterResponse: (task) => { tasks.push(task); } };
    return { group, t, tasks, d };
  }

  async function categoryOf(groupId: string) {
    const { data } = await adminClient().from("transactions")
      .select("category_id, category_source").eq("group_id", groupId).single();
    return data;
  }

  it("응답은 분류를 기다리지 않고, 예약된 작업이 카테고리를 채운다", async () => {
    const classify = vi.fn<CategoryClassifier>(async () => ({ name: "카페", confidence: 0.98 }));
    const { group, t, tasks, d } = await setup("auto-ok", classify);

    const res = await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    expect(res.status).toBe(200);
    expect(classify).not.toHaveBeenCalled();
    expect(tasks).toHaveLength(1);

    await tasks[0]();
    expect(await categoryOf(group.groupId)).toMatchObject({ category_source: "ai" });
  });

  it("같은 문자가 다시 오면(duplicate) 분류를 예약하지 않는다", async () => {
    const { t, tasks, d } = await setup("auto-dup", async () => ({ name: "카페", confidence: 0.98 }));
    await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    const again = await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    expect(await again.json()).toEqual({ status: "duplicate" });
    expect(tasks).toHaveLength(1);
  });

  it("키가 없으면(classify 없음) 예약하지 않는다", async () => {
    const { t, tasks, d } = await setup("auto-nokey", null);
    await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    expect(tasks).toHaveLength(0);
  });

  it("분류 중 예외가 나도 작업은 실패하지 않고 거래는 미지정으로 남는다", async () => {
    const { group, t, tasks, d } = await setup("auto-throw", async () => { throw new Error("boom"); });
    await handleIngest(post({ body: APPROVAL, source: "manual_test" }, t), d);
    await expect(tasks[0]()).resolves.toBeUndefined();
    expect(await categoryOf(group.groupId)).toEqual({ category_id: null, category_source: null });
  });
});
