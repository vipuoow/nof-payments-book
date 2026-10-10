import { defineConfig, devices } from "@playwright/test";

// 로컬 Supabase 주소·키(.env.local)를 테스트 도우미와 개발 서버가 함께 쓴다
process.loadEnvFile(".env.local");

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { ...devices["iPhone 13"], baseURL: "http://127.0.0.1:3100" },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3100/login",
    reuseExistingServer: true,
    timeout: 120_000,
    // 화면 테스트에서 실제 jev를 부르지 않는다
    // 화면 테스트에서 실제 환율 API를 부르지 않는다
    env: { TYPESAFE_API_KEY: "", FX_SCHEDULE: "off" },
  },
});
