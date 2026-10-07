/** 이번 달 결제가 아직 없을 때 목록 자리 */
export function EmptyCheer() {
  return (
    <section className="flex flex-col items-center gap-2 py-10 text-center">
      <div aria-hidden className="mascot h-20 w-20" />
      <p className="text-lg font-bold leading-snug">잘하고 있어요!<br />조금만 더 버텨봐요!</p>
      <p className="text-sm text-muted">다음 카드 결제부터 여기에 쏙 들어와요.</p>
    </section>
  );
}
