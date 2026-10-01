import { loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // .env.test.local 등 테스트용 환경변수를 읽는다
    env: loadEnv("test", process.cwd(), ""),
    testTimeout: 20_000,
  },
});
