/**
 * 연결 안내 그림: 다른 앱(단축어·MacroDroid)에서 눌러야 할 곳을 단순한 도형으로 그리고 파란 테두리로 표시한다.
 * 실제 앱 화면을 옮긴 것이 아니라 위치를 알려 주는 예시다.
 */
const HL = "outline outline-[3px] outline-offset-2 outline-accent rounded-lg motion-safe:animate-pulse";
const BOX = "flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 text-sm";

export function GuideIllus({ id }: { id: string }) {
  switch (id) {
    case "shortcut":
      return (
        <div aria-hidden className={`${BOX} items-center text-center`}>
          <b>가계부로 보내기</b>
          <span className="text-muted">메시지를 가계부로 보내요</span>
          <span className={`${HL} w-full bg-[#0a84ff] py-2 font-semibold text-white`}>단축어 추가</span>
        </div>
      );
    case "paste":
      return (
        <div aria-hidden className={BOX}>
          <div className="flex items-center justify-between font-bold"><span>가계부로 보내기</span><span className={`${HL} px-2 text-accent`}>⋯</span></div>
          <span className={`${HL} bg-background p-2 text-xs text-muted`}>여기에연결코드붙여넣기</span>
          <span className="h-2.5 rounded bg-background" />
        </div>
      );
    case "automation":
      return (
        <div aria-hidden className={BOX}>
          <div className="flex items-center justify-between font-bold"><span>자동화</span><span className={`${HL} px-2 text-accent`}>+</span></div>
          <span className={`${HL} bg-background p-2`}>💬 메시지</span>
          <div className="flex justify-around border-t border-line pt-2 text-xs text-muted"><span>단축어</span><span className={`${HL} px-2`}>자동화</span><span>갤러리</span></div>
        </div>
      );
    case "keyword":
      return (
        <div aria-hidden className={BOX}>
          <span className="text-muted">메시지에 다음이 포함됨</span>
          <b className={`${HL} bg-background px-3 py-2`}>KB국민카드</b>
          <div className="flex items-center justify-between"><span>즉시 실행</span><span className={`${HL} h-6 w-10 rounded-full bg-[#34c759]`} /></div>
        </div>
      );
    case "install":
      return (
        <div aria-hidden className={`${BOX} flex-row items-center gap-3`}>
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#2b6de8] text-xl font-extrabold text-white">M</span>
          <span className="flex-1"><b className="block">MacroDroid</b><span className="text-xs text-muted">자동화 앱</span></span>
          <span className={`${HL} bg-accent px-3 py-1.5 font-semibold text-white`}>설치</span>
        </div>
      );
    case "trigger":
      return (
        <div aria-hidden className={BOX}>
          <span className="text-xs text-muted">트리거</span>
          <span className={`${HL} bg-background p-2`}>✉ SMS 수신 · 내용에 카드 글자 포함</span>
        </div>
      );
    case "http":
      return (
        <div aria-hidden className={BOX}>
          <span className="text-xs text-muted">동작</span>
          <span className={`${HL} bg-background p-2`}>🌐 HTTP 요청 · POST</span>
        </div>
      );
    case "battery":
      return (
        <div aria-hidden className={BOX}>
          <span className="text-muted">MacroDroid 배터리 사용</span>
          <div className="flex items-center justify-between"><span>제한 없음</span><span className={`${HL} h-6 w-10 rounded-full bg-[#34c759]`} /></div>
        </div>
      );
    default:
      return null;
  }
}
