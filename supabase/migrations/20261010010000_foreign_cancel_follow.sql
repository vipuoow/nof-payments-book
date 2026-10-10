-- 해외 결제 금액을 고치면(실제 청구액) 연결된 해외 취소의 원화도 같이 맞춘다. 취소된 결제의 합계가 0으로 남게 한다.
-- 취소 줄은 카드 거래 보호 규칙에 막히므로 함수 주인 권한(security definer)으로 고친다.
create function public.follow_foreign_cancel()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.transactions
  set amount = -new.amount, amount_estimated = new.amount_estimated
  where cancels_transaction_id = new.id and kind = 'cancel' and currency is not null;
  return null;
end;
$$;
revoke execute on function public.follow_foreign_cancel() from public, anon, authenticated;

create trigger transactions_follow_foreign_cancel
  after update of amount on public.transactions
  for each row
  when (new.kind = 'approval' and new.currency is not null and new.amount is distinct from old.amount)
  execute function public.follow_foreign_cancel();
