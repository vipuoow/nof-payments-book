"use client";

import { useActionState, useState } from "react";
import { deleteGroupAction, type OpState } from "@/app/operator/actions";
import type { OverviewGroup } from "@/auth/operator";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "없음";

/** 그룹 하나: 구성원·연결 상태·거래 수·마지막 문자, 그룹장 닉네임을 입력해야 없앤다 */
export function GroupCard({ group }: { group: OverviewGroup }) {
  const owner = group.members.find((m) => m.role === "owner");
  const hasOperator = group.members.some((m) => m.isOperator);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState<OpState, FormData>(deleteGroupAction.bind(null, group.id), null);
  return (
    <li data-testid={`group-${group.id}`} className="card flex flex-col gap-3 !p-4">
      <div className="flex items-baseline justify-between gap-2">
        <b>{owner?.name ?? "?"}님 그룹 · {group.members.length}명</b>
        <span className="shrink-0 text-xs text-muted">{when(group.createdAt)} 만듦</span>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {group.members.map((m) => (
          <li key={m.userId} className="flex justify-between gap-2">
            <span>{m.name} <span className="text-xs text-muted">{m.role === "owner" ? "그룹장" : "그룹원"}{m.isOperator ? " · 운영자" : ""}</span></span>
            <span className={m.connected ? "text-ok" : "text-danger"}>{m.connected ? "연결됨" : "연결 전"}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">거래 {group.txCount}건 · 마지막 문자 {when(group.lastMessageAt)}</p>
      {hasOperator ? (
        <p className="text-xs text-muted">운영자가 들어 있는 그룹은 없앨 수 없어요.</p>
      ) : open ? (
        <form action={formAction} className="flex flex-col gap-2 rounded-2xl bg-danger/10 p-3">
          <p className="text-sm">그룹의 거래·문자·예산·분류·초대가 모두 지워지고 되돌릴 수 없어요. 계정과 휴대폰 연결은 남고, 가계부를 다시 만들려면 서비스 초대를 다시 받아야 해요.</p>
          <label className="flex flex-col gap-1 text-sm">
            그룹장 닉네임
            <input name="confirm" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={owner?.name} autoComplete="off"
              className="rounded-lg bg-surface px-3 py-2 text-base" />
          </label>
          {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setOpen(false); setTyped(""); }} className="rounded-xl bg-surface py-2.5 text-sm">취소</button>
            <button disabled={pending || typed.trim() !== owner?.name} className="rounded-xl bg-danger py-2.5 text-sm font-semibold text-white disabled:opacity-40">영구 삭제</button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="self-end text-sm text-danger">그룹 없애기</button>
      )}
    </li>
  );
}
