-- 거래를 고칠 때도 사용자는 같은 그룹 사람이어야 한다
drop policy transactions_update on public.transactions;
create policy transactions_update on public.transactions
  for update to authenticated
  using (group_id = public.my_group_id())
  with check (
    group_id = public.my_group_id()
    and user_id in (select user_id from public.group_members where group_id = public.my_group_id())
  );
