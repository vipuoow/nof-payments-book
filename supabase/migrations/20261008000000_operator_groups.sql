-- 운영자 서비스 화면(2026-10-08): 그룹 현황, 그룹 없애기(그룹 정보 삭제·계정과 휴대폰 연결은 남김·가계부 만들기 권한 회수),
-- 가계부 없는 계정 정리(계정 지우기는 앱 서버가 Auth 관리 API로 한다. 여기서는 확인과 초대 기록 정리만).

-- 가계부가 없어진 때. 다시 그룹에 들어가면 지운다.
alter table public.profiles add column left_group_at timestamptz;

create function public.clear_left_group_at() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.profiles set left_group_at = null where user_id = new.user_id and left_group_at is not null;
  return new;
end
$$;
create trigger group_members_clear_left_group_at after insert on public.group_members
for each row execute function public.clear_left_group_at();

create function public.require_operator() returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.profiles where user_id = auth.uid() and is_operator) then
    raise exception 'not_allowed';
  end if;
end
$$;

-- 현황: 사용자 수, 그룹(구성원·연결·거래 수·마지막 문자), 가계부 없는 계정
create function public.operator_overview() returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_operator();
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'max_users', public.setting_int('max_users'),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'created_at', g.created_at,
        'tx_count', (select count(*) from public.transactions t where t.group_id = g.id),
        'last_message_at', (select max(r.received_at) from public.raw_messages r where r.group_id = g.id),
        'members', (
          select jsonb_agg(jsonb_build_object(
            'user_id', m.user_id, 'name', p.display_name, 'role', m.role, 'is_operator', p.is_operator,
            'connected', exists (select 1 from public.ingest_tokens t
                                 where t.user_id = m.user_id and t.revoked_at is null and t.last_used_at is not null)
          ) order by (m.role = 'owner') desc, p.display_name)
          from public.group_members m join public.profiles p on p.user_id = m.user_id
          where m.group_id = g.id)
      ) order by g.created_at)
      from public.groups g), '[]'::jsonb),
    'groupless', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', p.user_id, 'name', p.display_name, 'since', coalesce(p.left_group_at, p.created_at), 'is_operator', p.is_operator,
        'connected', exists (select 1 from public.ingest_tokens t
                             where t.user_id = p.user_id and t.revoked_at is null and t.last_used_at is not null)
      ) order by coalesce(p.left_group_at, p.created_at))
      from public.profiles p
      where not exists (select 1 from public.group_members m where m.user_id = p.user_id)), '[]'::jsonb)
  );
end
$$;

-- 그룹 없애기: 그룹장 닉네임으로 한 번 더 확인. 운영자가 든 그룹은 지우지 않는다.
create function public.operator_delete_group(p_group uuid, p_confirm text) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_owner text;
  v_members uuid[];
begin
  perform public.require_operator();
  -- 초대 수락과 같은 잠금: 지우는 사이에 누가 들어와 권한 회수에서 빠지는 일을 막는다
  perform pg_advisory_xact_lock(hashtextextended('accept_invite', 0));
  select p.display_name into v_owner
  from public.groups g join public.profiles p on p.user_id = g.owner_id where g.id = p_group;
  if v_owner is null then raise exception 'not_found'; end if;
  if trim(coalesce(p_confirm, '')) <> v_owner then raise exception 'confirm_mismatch'; end if;
  select array_agg(user_id) into v_members from public.group_members where group_id = p_group;
  if exists (select 1 from public.profiles where user_id = any(v_members) and is_operator) then
    raise exception 'operator_group';
  end if;
  -- 그룹을 지우면 구성원·거래·문자·예산·분류·가게 규칙·초대가 함께 지워진다(on delete cascade)
  delete from public.groups where id = p_group;
  update public.profiles set can_create_group = false, left_group_at = now() where user_id = any(v_members);
  return coalesce(array_length(v_members, 1), 0);
end
$$;

-- 계정 지우기 전 확인: 가계부 없는 계정만, 운영자 계정은 안 된다. 사용한 서비스 초대 기록은 남기고 사용자 칸만 비운다.
create function public.operator_prepare_delete_account(p_user uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_operator();
  if not exists (select 1 from public.profiles where user_id = p_user) then raise exception 'not_found'; end if;
  if exists (select 1 from public.profiles where user_id = p_user and is_operator) then raise exception 'operator_account'; end if;
  if exists (select 1 from public.group_members where user_id = p_user) then raise exception 'in_group'; end if;
  update public.service_invites set used_by = null where used_by = p_user;
  update public.group_invites set used_by = null where used_by = p_user;
end
$$;

revoke execute on function public.clear_left_group_at() from public, anon, authenticated;
revoke execute on function public.require_operator() from public, anon;
grant execute on function public.require_operator() to authenticated;
revoke execute on function public.operator_overview() from public, anon;
grant execute on function public.operator_overview() to authenticated;
revoke execute on function public.operator_delete_group(uuid, text) from public, anon;
grant execute on function public.operator_delete_group(uuid, text) to authenticated;
revoke execute on function public.operator_prepare_delete_account(uuid) from public, anon;
grant execute on function public.operator_prepare_delete_account(uuid) to authenticated;
