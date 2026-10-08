"use client";

/** 홈 머리의 +: 그 자리에서 새로 추가 화면이 커진다(주소에 add=1을 쌓는다) */
export function AddButton({ month }: { month: string }) {
  const href = `/?month=${month}&add=1`;
  return (
    <a
      href={href} data-add-button aria-label="새로 추가" className="grid h-10 w-10 place-items-center rounded-full text-2xl text-accent"
      onClick={(e) => {
        e.preventDefault();
        window.history.pushState({ lx: true }, "", href);
      }}
    >
      +
    </a>
  );
}
