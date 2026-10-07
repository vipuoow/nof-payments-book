import Link from "next/link";

/** 처음 홈 1단계: 그룹 안에서 아무도 휴대폰을 연결하지 않았다 */
export function ConnectPrompt() {
  return (
    <section className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col items-center gap-3 pt-6 text-center">
        <div aria-hidden className="mascot h-36 w-36" />
        <h1 className="mt-2 text-2xl font-bold">내 휴대폰을 연결해 주세요</h1>
        <p className="text-muted">카드 결제 문자가 오면<br />가계부 친구가 알아서 적어 둘게요.</p>
        <ol className="mt-4 grid w-full grid-cols-3 gap-2 text-xs text-muted">
          {["단축어·앱 받기", "연결 코드 넣기", "자동 실행 켜기"].map((s, i) => (
            <li key={s} className="flex flex-col items-center gap-1">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft font-bold text-accent">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-2 pt-6">
        <Link href="/devices" className="block rounded-2xl bg-accent py-4 text-center font-semibold text-white">내 휴대폰 연결하기</Link>
        <p className="text-center text-xs text-muted">함께 쓰는 가족도 각자 휴대폰에서 연결해야 결제가 함께 모여요.</p>
      </div>
    </section>
  );
}
