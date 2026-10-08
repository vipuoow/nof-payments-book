import { headers } from "next/headers";
import { absoluteUrl, detectInApp, externalOpenUrl, outsideBrowser } from "@/lib/in-app";
import { CopyAddress } from "./copy-address";

/**
 * 앱 안 브라우저(카카오톡 등)로 열렸으면 Safari로 열라고 안내한다. 이런 브라우저에서는
 * 아이폰 단축어 추가 버튼이 눌리지 않고 Google 로그인도 막힐 수 있다. 일반 브라우저면 아무것도 그리지 않는다.
 */
export async function InAppNotice({ path, tone = "light", reason }: { path: string; tone?: "light" | "dark"; reason?: string }) {
  const h = await headers();
  const ua = h.get("user-agent");
  const inApp = detectInApp(ua);
  if (!inApp) return null;
  const browser = outsideBrowser(ua);
  const url = absoluteUrl(process.env.APP_URL, h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"), path);
  const open = url ? externalOpenUrl(inApp.app, url) : null;
  const box = tone === "dark" ? "bg-black/55 text-white backdrop-blur-sm" : "bg-danger/10 text-foreground";
  return (
    <div role="note" className={`flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm ${box}`}>
      <p className="font-semibold">{inApp.name} 안에서 열려 있어요</p>
      <p className={tone === "dark" ? "text-white/85" : "text-muted"}>
        {reason ?? "로그인이나 단축어 추가가 안 될 수 있어요."} {browser}에서 열어 주세요.
      </p>
      {open ? (
        <a href={open} aria-label={`${browser}로 열기 (다른 앱으로 넘어가요)`} className="mt-1 block rounded-xl bg-white py-2.5 text-center font-semibold text-[#1f1f1f]">{browser}로 열기</a>
      ) : (
        <>
          <p className={tone === "dark" ? "text-white/85" : "text-muted"}>화면 오른쪽 위나 아래의 [⋯] → [다른 브라우저로 열기]를 눌러 주세요. {url ? `메뉴가 없으면 주소를 복사해 ${browser}에 붙여넣어요.` : ""}</p>
          {url && <CopyAddress url={url} />}
        </>
      )}
    </div>
  );
}
