-- 온누리상품권 결제 표시(2026-10-08): 카드 승인 문자로 들어왔지만 디지털 온누리상품권으로 낸 결제(카드 대금 미청구).
-- 쓴 돈·한도에는 그대로 넣고, 결제 수단 표시만 "온누리상품권"으로 바꾼다. 거래 창의 체크로만 바꾼다.
alter table public.transactions add column paid_with text check (paid_with in ('onnuri'));
grant update (paid_with) on public.transactions to authenticated;
