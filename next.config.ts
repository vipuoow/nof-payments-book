import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // 로컬 주소(APP_URL)가 127.0.0.1이라 개발 서버 리소스(HMR·청크)를 허용한다. 개발 모드에만 적용된다.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
