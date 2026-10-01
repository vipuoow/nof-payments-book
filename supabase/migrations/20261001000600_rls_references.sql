-- 카테고리는 기본 또는 내 그룹 것만 쓸 수 있다
create function public.is_my_category(p_category uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select p_category is null or exists (
    select 1 from public.categories
    where id = p_category and (group_id is null or group_id = public.my_group_id())
  )
$$;
revoke execute on function public.is_my_category(uuid) from public, anon;
grant execute on function public.is_my_category(uuid) to authenticated;

-- 거래: 직접 넣을 수 있는 칸을 제한하고 카테고리를 검사한다
revoke insert on public.transactions from authenticated;
grant insert (group_id, user_id, kind, amount, merchant, occurred_at, category_id, memo)
  on public.transactions to authenticated;

drop policy transactions_insert_manual on public.transactions;
create policy transactions_insert_manual on public.transactions
  for insert to authenticated
  with check (
    group_id = public.my_group_id()
    and kind = 'manual'
    and user_id in (select user_id from public.group_members where group_id = public.my_group_id())
    and public.is_my_category(category_id)
  );

drop policy transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (group_id = public.my_group_id())
  with check (
    group_id = public.my_group_id()
    and user_id in (select user_id from public.group_members where group_id = public.my_group_id())
    and public.is_my_category(category_id)
  );

drop policy merchant_rules_group on public.merchant_rules;
create policy merchant_rules_group on public.merchant_rules
  for all to authenticated
  using (group_id = public.my_group_id())
  with check (group_id = public.my_group_id() and public.is_my_category(category_id));

drop policy budgets_group on public.budgets;
create policy budgets_group on public.budgets
  for all to authenticated
  using (group_id = public.my_group_id())
  with check (group_id = public.my_group_id() and public.is_my_category(category_id));
