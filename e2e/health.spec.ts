import { expect, test } from "@playwright/test";

test("배포 확인 주소는 로그인 없이 버전을 돌려준다", async ({ request }) => {
  const res = await request.get("/api/health", { maxRedirects: 0 });
  expect(res.status()).toBe(200);
  expect(res.headers()["cache-control"]).toContain("no-store");
  expect(await res.json()).toEqual({ ok: true, version: "dev" });
});
