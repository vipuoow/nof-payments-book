import type { ReactNode } from "react";
import { mediaDir, mediaVersion } from "@/lib/media";
import { LoopVideo } from "./loop-video";

/**
 * 처음 화면(설계 4.1): 배경 영상 위 한 겹에 제목·부제(화면 높이 30% 지점)와 아래쪽 버튼.
 * 영상 파일이 없으면 단색 배경으로 그대로 쓸 수 있다.
 */
export async function Landing({ note, error, children }: { note?: string; error?: string; children: ReactNode }) {
  const dir = mediaDir();
  const [v, p] = await Promise.all([mediaVersion(dir, "landing.mp4"), mediaVersion(dir, "landing.jpg")]);
  const poster = p ? `/media/landing.jpg?v=${p}` : null;
  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#9cc9e8] text-white">
      {v && <LoopVideo src={`/media/landing.mp4?v=${v}`} poster={poster} />}
      {!v && poster && <div aria-hidden className="absolute inset-0" style={{ background: `url(${poster}) center / cover` }} />}
      {/* 영상 전체를 35% 어둡게, 위쪽 제목과 아래쪽 버튼 부분은 조금 더 */}
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(to_bottom,rgb(12_9_6/.3),rgb(12_9_6/0)_20%,rgb(12_9_6/0)_64%,rgb(12_9_6/.5)),radial-gradient(70%_16%_at_50%_30%,rgb(12_9_6/.35),transparent),linear-gradient(rgb(12_9_6/.35),rgb(12_9_6/.35))]" />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="absolute inset-x-6 top-[30%] -translate-y-1/2">
          <h1 className="text-[34px] font-extrabold tracking-tight [text-shadow:0_2px_12px_rgb(0_0_0/.35)]">같이가계부</h1>
          <p className="mt-2 text-[17px] text-white/90 [text-shadow:0_1px_8px_rgb(0_0_0/.35)]">카드만 써, 기록은 내가 할게</p>
        </div>
        <div className="mt-auto flex flex-col gap-3">
          {note && <p className="rounded-xl bg-white/20 px-3 py-2.5 text-center text-sm backdrop-blur-sm">{note}</p>}
          {error && <p role="alert" className="rounded-xl bg-black/40 px-3 py-2.5 text-center text-sm">{error}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
