/**
 * 겹쳐 뜨는 화면의 움직임(시안 21판 기준).
 * - 펼치기: 누른 줄(또는 + 버튼) 자리에서 화면 전체로 커진다. 뒤의 홈은 살짝 작아지고 어두워진다.
 * - 하수구로 닫기: 이동은 처음부터 부드럽게, 크기는 비율을 유지한 채 점점 빨리 작아지고, 회전은 45°만.
 *   글자가 먼저 흐려진다. 다 들어가면 그 자리에 파문이 퍼지고 줄이 튕기며 반짝인다.
 * 휴대폰의 '동작 줄이기'가 켜져 있으면 움직임 없이 바로 바뀐다.
 */

export const DRAIN_MS = 520;
const EXPAND_MS = 480;
const ZOOM = "lx-zoomed";

export function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const full = () => ({ left: 0, top: 0, width: window.innerWidth, height: window.innerHeight });

/** 뒤 홈을 작게(겹친 화면이 열려 있는 동안) */
export function zoomHome(on: boolean) {
  document.documentElement.classList.toggle(ZOOM, on);
}

/** 뒤 홈이 원래 크기일 때의 위치(작아지는 중이어도 끝난 뒤 자리를 잰다) */
function settledRect(el: Element): DOMRect {
  const root = document.documentElement;
  if (!root.classList.contains(ZOOM)) return el.getBoundingClientRect();
  const main = document.querySelector("main");
  const prev = main?.style.transition ?? "";
  if (main) main.style.transition = "none";
  root.classList.remove(ZOOM);
  const r = el.getBoundingClientRect();
  root.classList.add(ZOOM);
  void main?.offsetWidth;
  if (main) main.style.transition = prev;
  return r;
}

/** 줄이 화면 밖이면 가운데로 옮긴다(주소로 바로 연 거래 등) */
function bringIntoView(el: Element) {
  const r = el.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) el.scrollIntoView({ block: "center" });
}

export function expandFrom(layer: HTMLElement, from: Element | null, radius: number, done: () => void) {
  zoomHome(true);
  if (!from || reducedMotion() || !layer.animate) {
    done();
    return;
  }
  bringIntoView(from);
  const r = settledRect(from);
  const f = full();
  const a = layer.animate(
    [
      { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, borderRadius: `${radius}px` },
      { left: `${f.left}px`, top: `${f.top}px`, width: `${f.width}px`, height: `${f.height}px`, borderRadius: "0px" },
    ],
    { duration: EXPAND_MS, easing: "cubic-bezier(.2,.8,.2,1)" },
  );
  // 다 커지기 전에 안쪽 글자를 띄우기 시작한다
  const t = window.setTimeout(done, 220);
  a.oncancel = () => window.clearTimeout(t);
}

/** 하수구로 빨려 들어가듯 to 자리로 닫는다. to가 없으면 그냥 사라진다 */
export function drainInto(layer: HTMLElement, to: Element | null, done: () => void) {
  zoomHome(false);
  if (reducedMotion() || !layer.animate) {
    done();
    if (to) flashRow(to, false);
    return;
  }
  const fr = layer.getBoundingClientRect();
  if (to) bringIntoView(to);
  const tr = to ? settledRect(to) : new DOMRect(fr.left + fr.width / 2, fr.top + fr.height / 2, 0, 0);
  const dx = tr.left + tr.width / 2 - (fr.left + fr.width / 2);
  const dy = tr.top + tr.height / 2 - (fr.top + fr.height / 2);
  const opt = (easing: string): KeyframeAnimationOptions => ({ duration: DRAIN_MS, easing, fill: "forwards" });
  layer.classList.add("lx-draining");
  layer.animate([{ translate: "0 0" }, { translate: `${dx}px ${dy}px` }], opt("cubic-bezier(.45,0,.25,1)"));
  layer.animate([{ scale: "1" }, { scale: "0.55", offset: 0.5 }, { scale: "0.03" }], opt("cubic-bezier(.4,0,.9,.6)"));
  layer.animate([{ rotate: "0deg" }, { rotate: "-45deg" }], opt("cubic-bezier(.4,0,.6,1)"));
  layer.animate([{ borderRadius: "27px" }, { borderRadius: "40%", offset: 0.55 }, { borderRadius: "50%" }], opt("ease-in"));
  layer.animate([{ opacity: 1 }, { opacity: 1, offset: 0.65 }, { opacity: 0 }], opt("ease-in"));
  // 화면 속 글자는 먼저 흐려져, 화면이 일그러지는 대신 카드 하나가 빠져나가 보이게 한다
  for (const c of Array.from(layer.children)) {
    c.animate([{ opacity: 1, filter: "blur(0)" }, { opacity: 0, filter: "blur(2px)" }], { duration: DRAIN_MS * 0.45, easing: "ease-out", fill: "forwards" });
  }
  window.setTimeout(() => {
    done();
    if (to) flashRow(to, true);
  }, DRAIN_MS);
}

/** 들어간 자리: 파문 + 줄이 꿀꺽 튕기며 반짝 */
export function flashRow(el: Element, ripple: boolean) {
  if (ripple && !reducedMotion()) {
    const r = el.getBoundingClientRect();
    const ring = document.createElement("span");
    ring.className = "lx-ripple";
    ring.style.left = `${r.left + r.width / 2}px`;
    ring.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(ring);
    window.setTimeout(() => ring.remove(), 700);
  }
  el.classList.remove("lx-gulp");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("lx-gulp");
  window.setTimeout(() => el.classList.remove("lx-gulp"), 1200);
}

/** 위치·크기 차이만큼 옮겨 둔 뒤 제자리로(쌓이는 값이 질문 자리에서 위로 올라간다) */
export function flyFrom(el: HTMLElement, from: DOMRect | null) {
  if (reducedMotion() || !el.animate) return;
  const to = el.getBoundingClientRect();
  const start = from
    ? { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(1.12)`, opacity: 0.2 }
    : { transform: "translateY(14px)", opacity: 0 };
  el.animate([start, { transform: "none", opacity: 1 }], { duration: 500, easing: "cubic-bezier(.2,.9,.25,1.1)" });
}

/** 줄이 접히며 사라진다 */
export function collapse(el: HTMLElement, done: () => void) {
  if (reducedMotion() || !el.animate) {
    done();
    return;
  }
  const h = el.getBoundingClientRect().height;
  el.style.overflow = "hidden";
  el.animate([{ height: `${h}px`, opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 300, easing: "ease", fill: "forwards" })
    .onfinish = done;
}
