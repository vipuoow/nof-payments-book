-- 같이가계부 디자인 1차(설계 2026-10-07): 닉네임은 그룹장이 정한다, 초대 링크는 하나만 살아 있다, 처음 홈 상태.

-- 닉네임 확인: 공백을 뺀 1~10자
create function public.check_nickname(p_name text) returns text
language plpgsql immutable set search_path = public
as $$
declare
  v text := trim(coalesce(p_name, ''));
begin
  if v = '' then raise exception 'name_required'; end if;
  if char_length(v) > 10 then raise exception 'name_too_long'; end if;
  return v;
end
$$;

-- 그룹 초대에 가족 닉네임
alter table public.group_invites add column invitee_name text;
-- 그룹장이 파트너 초대 화면에서 기다리는 사람의 닉네임을 본다(읽기 정책은 그룹장만)
grant select (invitee_name) on public.group_invites to authenticated;

-- 가계부 만들기: 그룹을 만들면서 내 닉네임을 저장한다
drop function public.create_group();
create function public.create_group(p_display_name text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text := public.check_nickname(p_display_name);
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and can_create_group) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from public.group_members where user_id = auth.uid()) then
    raise exception 'already_in_group';
  end if;
  insert into public.groups (owner_id) values (auth.uid()) returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, auth.uid(), 'owner');
  update public.profiles set display_name = v_name where user_id = auth.uid();
  return v_id;
end
$$;
revoke execute on function public.create_group(text) from public, anon;
grant execute on function public.create_group(text) to authenticated;

-- 파트너 초대: 가족 닉네임을 저장하고, 쓰지 않은 이전 링크는 취소한다(링크는 늘 하나만)
drop function public.create_group_invite(text);
create function public.create_group_invite(p_token_hash text, p_invitee_name text) returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_name text := public.check_nickname(p_invitee_name);
  v_expires timestamptz := now() + make_interval(days => public.setting_int('invite_ttl_days'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select group_id into v_group from public.group_members where user_id = auth.uid() and role = 'owner';
  if v_group is null then raise exception 'not_allowed'; end if;
  update public.group_invites set revoked_at = now()
  where group_id = v_group and used_at is null and revoked_at is null;
  insert into public.group_invites (group_id, token_hash, created_by, expires_at, invitee_name)
  values (v_group, p_token_hash, auth.uid(), v_expires, v_name);
  return v_expires;
end
$$;
revoke execute on function public.create_group_invite(text, text) from public, anon;
grant execute on function public.create_group_invite(text, text) to authenticated;

-- 초대 수락: 그룹 초대면 그룹장이 정한 닉네임을 쓴다(이미 프로필이 있어도 바꾼다).
-- 닉네임 없이 만든 예전 초대와 서비스 초대는 넘어온 이름(Google 이름)을 쓴다.
create or replace function public.accept_invite(p_token_hash text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(coalesce(p_display_name, ''));
  v_has_profile boolean;
  s public.service_invites;
  g public.group_invites;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  perform pg_advisory_xact_lock(hashtextextended('accept_invite', 0));
  v_has_profile := exists (select 1 from public.profiles where user_id = v_user);

  select * into s from public.service_invites where token_hash = p_token_hash for update;
  if found then
    if v_name = '' then raise exception 'name_required'; end if;
    if s.used_at is not null then raise exception 'invite_used'; end if;
    if s.expires_at <= now() then raise exception 'invite_expired'; end if;
    if v_has_profile then
      update public.profiles set can_create_group = true where user_id = v_user;
    else
      if (select count(*) from public.profiles) >= public.setting_int('max_users') then
        raise exception 'service_full';
      end if;
      insert into public.profiles (user_id, display_name, can_create_group) values (v_user, v_name, true);
    end if;
    update public.service_invites set used_by = v_user, used_at = now() where id = s.id;
    return jsonb_build_object('kind', 'service', 'group_id', null);
  end if;

  select * into g from public.group_invites where token_hash = p_token_hash for update;
  if not found then raise exception 'invite_invalid'; end if;
  v_name := coalesce(nullif(trim(coalesce(g.invitee_name, '')), ''), v_name);
  if v_name = '' then raise exception 'name_required'; end if;
  if g.revoked_at is not null then raise exception 'invite_revoked'; end if;
  if g.used_at is not null then raise exception 'invite_used'; end if;
  if g.expires_at <= now() then raise exception 'invite_expired'; end if;
  if exists (select 1 from public.group_members where user_id = v_user) then
    raise exception 'already_in_group';
  end if;
  if (select count(*) from public.group_members where group_id = g.group_id)
     >= public.setting_int('max_group_members') then
    raise exception 'group_full';
  end if;
  if v_has_profile then
    update public.profiles set display_name = v_name where user_id = v_user;
  else
    if (select count(*) from public.profiles) >= public.setting_int('max_users') then
      raise exception 'service_full';
    end if;
    insert into public.profiles (user_id, display_name) values (v_user, v_name);
  end if;
  insert into public.group_members (group_id, user_id, role) values (g.group_id, v_user, 'member');
  update public.group_invites set used_by = v_user, used_at = now() where id = g.id;
  return jsonb_build_object('kind', 'group', 'group_id', g.group_id);
end
$$;

-- 초대 상태(가입 전 확인용, 서버 전용): 가족 닉네임을 더한다
create or replace function public.invite_status(p_token_hash text) returns jsonb
language plpgsql stable set search_path = public
as $$
declare
  s public.service_invites;
  g public.group_invites;
  v_users_full boolean := (select count(*) from public.profiles) >= public.setting_int('max_users');
begin
  select * into s from public.service_invites where token_hash = p_token_hash;
  if found then
    if s.used_at is not null then return jsonb_build_object('status', 'used'); end if;
    if s.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
    if v_users_full then return jsonb_build_object('status', 'service_full'); end if;
    return jsonb_build_object('status', 'valid', 'kind', 'service');
  end if;

  select * into g from public.group_invites where token_hash = p_token_hash;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if g.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if g.used_at is not null then return jsonb_build_object('status', 'used'); end if;
  if g.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if (select count(*) from public.group_members where group_id = g.group_id)
     >= public.setting_int('max_group_members') then
    return jsonb_build_object('status', 'group_full');
  end if;
  if v_users_full then return jsonb_build_object('status', 'service_full'); end if;
  return jsonb_build_object(
    'status', 'valid', 'kind', 'group',
    'inviter_name', (select display_name from public.profiles where user_id = g.created_by),
    'invitee_name', g.invitee_name
  );
end
$$;

-- 처음 홈 상태: 파트너의 기기 연결 여부도 봐야 해서(RLS는 자기 기기만) 보안 정의 함수로 요약만 돌려준다.
-- 연결됨 = 폐기되지 않은 연결 코드로 문자(또는 연결 시험)가 한 번이라도 도착함
create function public.group_setup_status() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_group uuid;
  v_invite public.group_invites;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select group_id into v_group from public.group_members where user_id = auth.uid();
  if v_group is null then raise exception 'not_in_group'; end if;

  select * into v_invite from public.group_invites
  where group_id = v_group and used_at is null and revoked_at is null
  order by created_at desc limit 1;

  return jsonb_build_object(
    'any_connected', exists (
      select 1 from public.ingest_tokens t join public.group_members m on m.user_id = t.user_id
      where m.group_id = v_group and t.revoked_at is null and t.last_used_at is not null),
    'connected_name', (
      select p.display_name from public.ingest_tokens t
      join public.group_members m on m.user_id = t.user_id
      join public.profiles p on p.user_id = t.user_id
      where m.group_id = v_group and t.revoked_at is null and t.last_used_at is not null
      order by (t.user_id = auth.uid()) desc, t.last_used_at desc limit 1),
    'me_connected', exists (
      select 1 from public.ingest_tokens t
      where t.user_id = auth.uid() and t.revoked_at is null and t.last_used_at is not null),
    'has_total_limit', exists (
      select 1 from public.budgets b where b.group_id = v_group and b.category_id is null and b.amount > 0),
    'member_count', (select count(*) from public.group_members where group_id = v_group),
    'pending_invite', case when v_invite.id is null then null else jsonb_build_object(
      'name', v_invite.invitee_name,
      'expires_at', v_invite.expires_at,
      'expired', v_invite.expires_at <= now()) end
  );
end
$$;
revoke execute on function public.group_setup_status() from public, anon;
grant execute on function public.group_setup_status() to authenticated;
