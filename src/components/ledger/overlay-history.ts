/**
 * 겹쳐 뜨는 화면을 열 때 쌓은 주소 수. 닫을 때 우리가 쌓은 것이면 뒤로 가고, 아니면(주소로 바로 연 화면) 주소만 바꾼다.
 * history.state에 표시를 두면 Next가 새로고침·서버 함수 뒤에 지워 버리므로 따로 센다.
 */
let depth = 0;
let expectingPop = false;

export function pushOverlay(url: string) {
  // Next가 이 객체에 내부 값을 덧붙이므로 매번 새로 만든다
  window.history.pushState({}, "", url);
  depth++;
}

export function popOverlay(fallback: string) {
  if (depth > 0) {
    depth--;
    expectingPop = true;
    window.history.back();
  } else {
    window.history.replaceState(null, "", fallback);
  }
}

/** 쌓은 주소 하나를 다른 주소로 바꿨다(새로 추가를 저장하고 그 달로 옮김) */
export function forgetOverlay() {
  depth = Math.max(0, depth - 1);
}

/** 휴대폰 '뒤로'로 닫힌 경우도 센다 */
export function onPopState() {
  if (expectingPop) expectingPop = false;
  else depth = Math.max(0, depth - 1);
}
