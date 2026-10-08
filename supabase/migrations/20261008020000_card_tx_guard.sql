-- 카드 문자로 들어온 거래(승인·취소)는 앱 사용자가 금액·가게·일시·사람을 바꾸거나 지울 수 없다.
-- 분류(category_*)·메모·온누리 표시(paid_with)는 바꿀 수 있다. 화면을 거치지 않은 직접 호출(PostgREST)도 막는다.
-- 문자 수신(service_role)·SECURITY DEFINER 함수(분류 학습, 운영자 그룹 삭제)는 current_user가 authenticated가 아니라 해당 없다.
create or replace function public.guard_card_transaction()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' or old.kind = 'manual' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'card_tx_locked' using errcode = '42501';
  end if;
  if new.amount is distinct from old.amount or new.merchant is distinct from old.merchant
     or new.occurred_at is distinct from old.occurred_at or new.user_id is distinct from old.user_id
     or new.kind is distinct from old.kind then
    raise exception 'card_tx_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger transactions_guard_card
  before update or delete on public.transactions
  for each row execute function public.guard_card_transaction();
