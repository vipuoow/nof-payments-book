"use client";

import { useEffect, useRef } from "react";

const FADE = 0.6;

/**
 * 끊김 없는 배경 영상: 같은 영상 두 개를 겹쳐 두고, 끝나기 0.6초 전에 다음 영상을 처음부터 재생하며 서로 바꾼다.
 * 화면에 보이지 않으면 멈춘다. '동작 줄이기'가 켜져 있으면 CSS가 영상을 숨기고 멈춘 그림(poster)을 보여 준다.
 */
export function LoopVideo({ src, poster }: { src: string; poster: string | null }) {
  const box = useRef<HTMLDivElement>(null);
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cur = a.current!;
    let next = b.current!;
    let busy = false;
    let visible = true;
    let frame = 0;
    const play = (v: HTMLVideoElement) => { void v.play().catch(() => {}); };
    const tick = () => {
      if (visible && !busy && cur.duration && cur.currentTime >= cur.duration - FADE) {
        busy = true;
        next.currentTime = 0;
        play(next);
        next.style.opacity = "1";
        cur.style.opacity = "0";
        setTimeout(() => {
          cur.pause();
          [cur, next] = [next, cur];
          busy = false;
        }, FADE * 1000 + 50);
      }
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) play(cur);
      else { cur.pause(); next.pause(); }
    });
    io.observe(box.current!);
    play(cur);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); io.disconnect(); };
  }, []);

  const cls = "absolute inset-0 h-full w-full object-cover transition-opacity duration-[600ms] ease-linear motion-reduce:hidden";
  return (
    <div ref={box} aria-hidden className="absolute inset-0" style={poster ? { background: `url(${poster}) center / cover` } : undefined}>
      <video ref={a} className={cls} src={src} poster={poster ?? undefined} muted playsInline preload="auto" />
      <video ref={b} className={cls} style={{ opacity: 0 }} src={src} muted playsInline preload="auto" />
    </div>
  );
}
