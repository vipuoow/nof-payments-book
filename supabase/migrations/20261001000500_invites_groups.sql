-- 이후 만드는 테이블·함수는 anon에 자동으로 열리지 않게 한다 (계획 1 Minor)
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- 정수 설정값
create function public.setting_int(p_key text) returns int
language sql stable set search_path = public
as $$
  select (value #>> '{}')::int from public.app_settings where key = p_key
$$;
revoke execute on function public.setting_int(text) from public, anon;

-- 서비스 초대 발급 (운영자)
create function public.create_service_invite(p_token_hash text) returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_expires timestamptz := now() + make_interval(days => public.setting_int('invite_ttl_days'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_operator) then
    raise exception 'not_allowed';
  end if;
  insert into public.service_invites (token_hash, created_by, expires_at)
  values (p_token_hash, auth.uid(), v_expires);
  return v_expires;
end
$$;

-- 그룹 생성 (그룹 생성 권한이 있고 아직 그룹이 없는 사람)
create function public.create_group(p_name text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name_required'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and can_create_group) then
    raise exception 'not_allowed';
  end if;
  if exists (select 1 from public.group_members where user_id = auth.uid()) then
    raise exception 'already_in_group';
  end if;
  insert into public.groups (name, owner_id) values (trim(p_name), auth.uid()) returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, auth.uid(), 'owner');
  return v_id;
end
$$;

-- 그룹 초대 발급·취소 (그룹장)
create function public.create_group_invite(p_token_hash text) returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_expires timestamptz := now() + make_interval(days => public.setting_int('invite_ttl_days'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select group_id into v_group from public.group_members where user_id = auth.uid() and role = 'owner';
  if v_group is null then raise exception 'not_allowed'; end if;
  insert into public.group_invites (group_id, token_hash, created_by, expires_at)
  values (v_group, p_token_hash, auth.uid(), v_expires);
  return v_expires;
end
$$;

create function public.revoke_group_invite(p_invite_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.group_invites i
  set revoked_at = now()
  where i.id = p_invite_id
    and i.used_at is null
    and i.revoked_at is null
    and i.group_id in (
      select group_id from public.group_members where user_id = auth.uid() and role = 'owner'
    );
end
$$;

-- 초대 상태 (가입 전 확인용, 서버 전용)
create function public.invite_status(p_token_hash text) returns jsonb
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
    'group_name', (select name from public.groups where id = g.group_id)
  );
end
$$;

-- 초대 수락: 프로필 생성·권한 부여·그룹 가입을 한 번에. 인원 제한이 동시 수락에도 지켜지도록 직렬화한다.
create function public.accept_invite(p_token_hash text, p_display_name text) returns jsonb
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
  if v_name = '' then raise exception 'name_required'; end if;

  perform pg_advisory_xact_lock(hashtextextended('accept_invite', 0));
  v_has_profile := exists (select 1 from public.profiles where user_id = v_user);

  select * into s from public.service_invites where token_hash = p_token_hash for update;
  if found then
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
  if not v_has_profile then
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

-- 기기 토큰 발급·폐기 (폐기는 이 함수로만: 사용자가 되살릴 수 없다)
create function public.issue_ingest_token(p_token_hash text, p_label text) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.group_members where user_id = auth.uid()) then
    raise exception 'not_in_group';
  end if;
  insert into public.ingest_tokens (user_id, token_hash, label)
  values (auth.uid(), p_token_hash, trim(coalesce(p_label, '')))
  returning id into v_id;
  return v_id;
end
$$;

create function public.revoke_ingest_token(p_token_id uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.ingest_tokens set revoked_at = now()
  where id = p_token_id and user_id = auth.uid() and revoked_at is null;
end
$$;

revoke update on public.ingest_tokens from authenticated;

-- 그룹장은 자기 그룹 초대 목록을 본다 (토큰 해시 제외)
create policy group_invites_read_owner on public.group_invites
  for select to authenticated
  using (group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'owner'));
grant select (id, group_id, expires_at, used_at, revoked_at, created_at) on public.group_invites to authenticated;

-- 실행 권한
revoke execute on function
  public.create_service_invite(text), public.create_group(text), public.create_group_invite(text),
  public.revoke_group_invite(uuid), public.accept_invite(text, text),
  public.issue_ingest_token(text, text), public.revoke_ingest_token(uuid),
  public.invite_status(text)
from public, anon;
grant execute on function
  public.create_service_invite(text), public.create_group(text), public.create_group_invite(text),
  public.revoke_group_invite(uuid), public.accept_invite(text, text),
  public.issue_ingest_token(text, text), public.revoke_ingest_token(uuid)
to authenticated;
grant execute on function public.invite_status(text) to service_role;
