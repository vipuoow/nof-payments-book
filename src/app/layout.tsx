import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { barColorOf, THEME_COOKIE, themeOf } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "같이가계부",
  description: "카드만 써, 기록은 내가 할게",
  appleWebApp: { capable: true, title: "같이가계부", statusBarStyle: "default" },
};

/** 화면 모드(쿠키)에 맞춰 휴대폰 위쪽 띠 색을 정한다 */
export async function generateViewport(): Promise<Viewport> {
  const theme = themeOf((await cookies()).get(THEME_COOKIE)?.value);
  return { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: barColorOf(theme) };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // 사람마다 고른 화면 모드. 쿠키가 없으면(로그인 전 등) 기본 모드
  const theme = themeOf((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="ko" data-theme={theme} className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
