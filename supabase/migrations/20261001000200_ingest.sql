-- 취소 문자에 연결할 승인 거래: 같은 그룹·사용자·금액·가맹점, 취소 시각 이전 60일 안,
-- 아직 취소가 연결되지 않은 것 중 가장 최근 것
create function public.find_cancel_target(
  p_group uuid, p_user uuid, p_amount bigint, p_merchant text, p_at timestamptz
) returns uuid
language sql stable set search_path = public
as $$
  select t.id
  from public.transactions t
  where t.group_id = p_group
    and t.user_id = p_user
    and t.kind = 'approval'
    and t.amount = p_amount
    and t.merchant = p_merchant
    and t.occurred_at <= p_at
    and t.occurred_at > p_at - interval '60 days'
    and not exists (
      select 1 from public.transactions c where c.cancels_transaction_id = t.id
    )
  order by t.occurred_at desc
  limit 1
$$;

revoke execute on function public.find_cancel_target(uuid, uuid, bigint, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.find_cancel_target(uuid, uuid, bigint, text, timestamptz)
  to service_role;
