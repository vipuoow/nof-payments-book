"use client";

/** 새로 추가 맨 앞: 카드 문자 붙여넣기 / 직접 적기 */
export function AddChoice({ onPaste, onDirect }: { onPaste: () => void; onDirect: () => void }) {
  return (
    <div className="lx-q">
      <h2>어떻게 적을까요?</h2>
      <div className="mt-2 flex w-full flex-col gap-2.5">
        <button type="button" className="add-choice" onClick={onPaste}>
          <b>카드 문자 붙여넣기</b>
          <span>받은 결제 문자를 붙여 넣으면 알아서 채워요</span>
        </button>
        <button type="button" className="add-choice" onClick={onDirect}>
          <b>직접 적기</b>
          <span>금액부터 하나씩 적어요</span>
        </button>
      </div>
    </div>
  );
}
