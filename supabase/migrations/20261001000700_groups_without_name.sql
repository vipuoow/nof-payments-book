-- 그룹에는 이름을 두지 않는다. 화면에는 그룹 이름 대신 역할(그룹장·그룹원)과 초대한 사람 이름을 보여 준다.
alter table public.groups drop column name;

drop function public.create_group(text);
create function public.create_group() returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
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
  return v_id;
end
$$;
revoke execute on function public.create_group() from public, anon;
grant execute on function public.create_group() to authenticated;

-- 그룹 초대 상태: 그룹 이름 대신 초대한 그룹장 이름
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
    'inviter_name', (select display_name from public.profiles where user_id = g.created_by)
  );
end
$$;
