-- 로그인 사용자의 그룹 id (한 사람 한 그룹)
create function public.my_group_id() returns uuid
language sql stable security definer set search_path = public
as $$
  select group_id from public.group_members where user_id = auth.uid()
$$;

revoke execute on function public.my_group_id() from public, anon;
grant execute on function public.my_group_id() to authenticated;

-- 권한: anon은 아무것도 못 하고, authenticated는 RLS 범위 안에서만
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.service_invites enable row level security;
alter table public.group_invites enable row level security;
alter table public.ingest_tokens enable row level security;
alter table public.categories enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.raw_messages enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- 설정: 읽기만
create policy app_settings_read on public.app_settings
  for select to authenticated using (true);

-- 프로필: 나와 같은 그룹 사람만 보고, 내 이름만 고친다
create policy profiles_read on public.profiles
  for select to authenticated
  using (
    user_id = auth.uid()
    or user_id in (select user_id from public.group_members where group_id = public.my_group_id())
  );
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- 그룹: 내 그룹만 보고, 그룹장만 이름을 고친다
create policy groups_read on public.groups
  for select to authenticated using (id = public.my_group_id());
create policy groups_update_owner on public.groups
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
revoke insert, update, delete on public.groups from authenticated;
grant update (name) on public.groups to authenticated;

-- 그룹 구성원: 읽기만 (가입·탈퇴는 서버 함수)
create policy group_members_read on public.group_members
  for select to authenticated using (group_id = public.my_group_id());
revoke insert, update, delete on public.group_members from authenticated;

-- 초대: 계획 2에서 정책 추가 전까지 사용자 접근 없음
revoke all on public.service_invites, public.group_invites from authenticated;

-- ingest 토큰: 내 것만 보고, 이름·폐기만 고친다 (발급은 서버)
create policy ingest_tokens_read_own on public.ingest_tokens
  for select to authenticated using (user_id = auth.uid());
create policy ingest_tokens_update_own on public.ingest_tokens
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke insert, update, delete on public.ingest_tokens from authenticated;
grant update (label, revoked_at) on public.ingest_tokens to authenticated;

-- 카테고리: 기본 + 내 그룹 것을 보고, 내 그룹 것만 고친다
create policy categories_read on public.categories
  for select to authenticated
  using (group_id is null or group_id = public.my_group_id());
create policy categories_write on public.categories
  for insert to authenticated with check (group_id = public.my_group_id());
create policy categories_update on public.categories
  for update to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
create policy categories_delete on public.categories
  for delete to authenticated using (group_id = public.my_group_id());

-- 가맹점 규칙·예산: 내 그룹 전체 권한
create policy merchant_rules_group on public.merchant_rules
  for all to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
create policy budgets_group on public.budgets
  for all to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());

-- 원문: 내 그룹 것을 보고, 상태만 고친다 (저장은 서버)
create policy raw_messages_read on public.raw_messages
  for select to authenticated using (group_id = public.my_group_id());
create policy raw_messages_update on public.raw_messages
  for update to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
revoke insert, update, delete on public.raw_messages from authenticated;
grant update (status) on public.raw_messages to authenticated;

-- 거래: 내 그룹 것을 보고 고치며, 직접 넣는 것은 수동 입력만
create policy transactions_read on public.transactions
  for select to authenticated using (group_id = public.my_group_id());
create policy transactions_insert_manual on public.transactions
  for insert to authenticated
  with check (
    group_id = public.my_group_id()
    and kind = 'manual'
    and user_id in (select user_id from public.group_members where group_id = public.my_group_id())
  );
create policy transactions_update on public.transactions
  for update to authenticated
  using (group_id = public.my_group_id()) with check (group_id = public.my_group_id());
create policy transactions_delete on public.transactions
  for delete to authenticated using (group_id = public.my_group_id());
revoke update on public.transactions from authenticated;
grant update (category_id, memo, amount, merchant, occurred_at, user_id) on public.transactions to authenticated;
