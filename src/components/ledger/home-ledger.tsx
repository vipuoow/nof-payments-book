"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { deleteTx } from "@/app/tx-actions";
import { AddFlow } from "./add-flow";
import type { DayView, LedgerChoices, RawView } from "./home-types";
import { Inbox } from "./inbox";
import { collapse, drainInto, expandFrom, zoomHome } from "./motion";
import { TxDetail } from "./tx-detail";
import { TxRows } from "./tx-rows";

/** 겹쳐 뜨는 화면은 주소 값으로 정한다: ?tx=<id> · ?add=1(&raw=<id>) · ?inbox=1 */
type Target = { kind: "tx"; id: string } | { kind: "add"; rawId: string | null } | { kind: "inbox" };

function targetOf(sp: URLSearchParams): Target | null {
  const tx = sp.get("tx");
  if (tx) return { kind: "tx", id: tx };
  if (sp.get("add") === "1") return { kind: "add", rawId: sp.get("raw") };
  if (sp.get("inbox") === "1") return { kind: "inbox" };
  return null;
}
const keyOf = (t: Target | null) => (!t ? "" : t.kind === "tx" ? `tx:${t.id}` : t.kind === "add" ? `add:${t.rawId ?? ""}` : "inbox");
const LABELS = { tx: "거래 상세", add: "새로 추가", inbox: "확인할 문자" } as const;

const noop = () => () => {};

/** 우리가 연 화면 표시(뒤로 가기로 닫을 수 있는지). Next가 이 객체에 내부 값을 덧붙이므로 매번 새로 만든다 */
const pushed = () => ({ lx: true });

/**
 * 홈 목록과 그 위에 겹쳐 뜨는 화면(거래 상세·새로 추가·확인할 문자), 지울지 묻는 창, 짧은 알림.
 * 열 때는 주소를 쌓고(pushState), 닫을 때는 뒤로 간다. 그래서 휴대폰 '뒤로'로 닫아도 같은 움직임이 나온다.
 */
export function HomeLedger({
  days, month, choices, meId, raws, nowIso, empty,
}: {
  days: DayView[]; month: string; choices: LedgerChoices; meId: string; raws: RawView[]; nowIso: string; empty: ReactNode;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const target = useMemo(() => targetOf(new URLSearchParams(sp.toString())), [sp]);
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const base = `/?month=${month}`;
  const rows = useMemo(() => new Map(days.flatMap((d) => d.items).map((t) => [t.id, t])), [days]);

  const [shown, setShown] = useState<Target | null>(null);
  const [isIn, setIn] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const opening = useRef(false);
  const closing = useRef(false);
  /** 새로 추가를 저장한 뒤 들어갈 새 줄 */
  const drainTo = useRef<string | null>(null);
  const [navPending, startNav] = useTransition();
  // 화면 위에 겹쳐 띄우는 부분(document.body)은 브라우저에서만 그린다
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const [openSwipe, setOpenSwipe] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletePending, startDelete] = useTransition();

  const go = useCallback((params: string) => {
    window.history.pushState(pushed(), "", `${base}&${params}`);
  }, [base]);
  const close = useCallback(() => {
    if (closing.current) return;
    if (window.history.state?.lx) window.history.back();
    else window.history.replaceState(null, "", base);
  }, [base]);

  // 주소가 바뀌면 화면을 열고·바꾸고·닫는다. 닫을 때는 움직임이 끝난 뒤에 지워야 해서
  // 주소에서 바로 계산하지 않고 지금 띄운 화면(shown)을 따로 둔다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (keyOf(target) === keyOf(shown) || closing.current) return;
    if (target && !shown) {
      if (target.kind === "tx" && !rows.has(target.id)) {
        // 다른 달·다른 그룹 거래는 열지 않는다
        window.history.replaceState(null, "", base);
        return;
      }
      opening.current = true;
      setIn(false);
      setShown(target);
      return;
    }
    if (target && shown) {
      // 확인할 문자 ↔ 새로 추가: 이미 화면 전체라 내용만 바꾼다
      setShown(target);
      setIn(true);
      return;
    }
    if (!target && shown && layer.current) {
      // 저장한 새 줄이 목록에 들어올 때까지 기다린다
      if (drainTo.current && navPending) return;
      const id = drainTo.current ?? (shown.kind === "tx" ? shown.id : null);
      drainTo.current = null;
      const to = (id && document.querySelector(`[data-row-id="${id}"]`))
        || document.querySelector(shown.kind === "inbox" ? "[data-inbox-button]" : "[data-add-button]");
      closing.current = true;
      drainInto(layer.current, to, () => {
        closing.current = false;
        setShown(null);
        setIn(false);
      });
    }
  }, [target, shown, rows, navPending, base]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // 화면이 붙은 뒤 누른 자리에서 커진다
  useLayoutEffect(() => {
    if (!shown || !opening.current || !layer.current) return;
    opening.current = false;
    const from = shown.kind === "tx"
      ? document.querySelector(`[data-row-id="${shown.id}"]`)
      : document.querySelector(shown.kind === "inbox" ? "[data-inbox-button]" : "[data-add-button]");
    expandFrom(layer.current, from, shown.kind === "tx" ? 0 : shown.kind === "inbox" ? 16 : 99, () => setIn(true));
    layer.current.focus();
  }, [shown]);

  useEffect(() => () => zoomHome(false), []);
  useEffect(() => {
    if (!shown) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [shown, close]);

  function saved(id: string, savedMonth: string) {
    drainTo.current = id;
    // 저장한 달로 옮겨 간다(같은 달이어도 새 목록을 받는다). 그 사이 주소에서 새로 추가가 빠지며 닫힌다
    startNav(() => router.replace(`/?month=${savedMonth}`, { scroll: false }));
  }

  function confirmDelete() {
    const id = deleting;
    if (!id || deletePending) return;
    startDelete(async () => {
      const r = await deleteTx(id);
      setDeleting(null);
      setOpenSwipe(null);
      if (!r.ok) return showToast(r.error);
      const li = document.querySelector<HTMLElement>(`[data-swipe-id="${id}"]`);
      const done = () => {
        showToast("지웠어요");
        router.refresh();
      };
      if (li) collapse(li, done);
      else done();
    });
  }

  const tx = shown?.kind === "tx" ? rows.get(shown.id) : undefined;
  const raw = shown?.kind === "add" && shown.rawId ? raws.find((r) => r.id === shown.rawId) ?? null : null;

  return (
    <>
      {raws.length > 0 && (
        <button
          type="button" data-inbox-button onClick={() => go("inbox=1")}
          className="mt-3 flex w-full justify-between rounded-2xl bg-accent-soft px-4 py-3 text-sm font-semibold text-accent"
        >
          <span>확인할 문자가 {raws.length}건 있어요</span><span aria-hidden>›</span>
        </button>
      )}
      {empty ?? (
        <TxRows
          days={days} hrefOf={(id) => `${base}&tx=${id}`} choices={choices}
          onOpen={(id) => go(`tx=${id}`)} onAskDelete={setDeleting} onToast={showToast}
          openSwipe={openSwipe} setOpenSwipe={setOpenSwipe}
        />
      )}

      {mounted && shown && createPortal(
        <div
          ref={layer} role="dialog" aria-modal="true" aria-label={LABELS[shown.kind]} tabIndex={-1}
          className={`lx-layer outline-none ${isIn ? "lx-in" : ""}`}
        >
          <div className="lx-inner">
            {shown.kind === "tx" && tx && (
              <TxDetail key={tx.id} tx={tx} choices={choices} now={now} onClose={close} onToast={showToast} />
            )}
            {shown.kind === "add" && (
              <AddFlow
                key={shown.rawId ?? "new"} meId={meId} now={now} choices={choices} raw={raw}
                onClose={close} onSaved={saved}
              />
            )}
            {shown.kind === "inbox" && (
              <Inbox raws={raws} choices={choices} onClose={close} onToast={showToast} onRegister={(id) => go(`add=1&raw=${id}`)} />
            )}
          </div>
        </div>,
        document.body,
      )}

      {mounted && deleting && createPortal(
        <>
          <div className="lx-dim" onClick={() => { setDeleting(null); setOpenSwipe(null); }} />
          <div role="alertdialog" aria-modal="true" aria-labelledby="lx-del-title" className="lx-confirm">
            <p id="lx-del-title" className="text-[17px] font-bold">이 거래를 지울까요?</p>
            <p className="mt-1 text-sm text-muted">직접 추가한 거래라 지울 수 있어요. 지우면 되돌릴 수 없어요.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" autoFocus className="rounded-[14px] bg-background py-3.5 font-semibold" onClick={() => { setDeleting(null); setOpenSwipe(null); }}>취소</button>
              <button type="button" disabled={deletePending} className="rounded-[14px] bg-danger py-3.5 font-semibold text-white disabled:opacity-50" onClick={confirmDelete}>지우기</button>
            </div>
          </div>
        </>,
        document.body,
      )}

      {mounted && toast && createPortal(<div role="status" className="lx-toast">{toast}</div>, document.body)}
    </>
  );
}
