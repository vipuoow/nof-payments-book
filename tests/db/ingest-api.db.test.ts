import { beforeAll, describe, expect, it } from "vitest";
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
    expect((await handleIngest(post({ body: "", source: "ios_shortcut" }, token), deps())).status).toBe(400);
    expect((await handleIngest(post({ body: APPROVAL, source: "pager" }, token), deps())).status).toBe(400);
    expect(
      (await handleIngest(post({ body: APPROVAL, source: "ios_shortcut", receivedAt: "어제" }, token), deps())).status,
    ).toBe(400);
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
