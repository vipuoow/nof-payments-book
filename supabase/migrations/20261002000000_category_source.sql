-- 거래 카테고리를 누가 정했는지: rule(가맹점 규칙), ai(jev 자동 분류), user(사용자)
alter table public.transactions
  add column category_source text check (category_source in ('rule', 'ai', 'user'));

-- jev 답의 확신이 이 값 이상일 때만 카테고리를 넣는다
insert into public.app_settings (key, value) values ('category_ai_min_confidence', '0.7');

-- 화면(authenticated)에서 카테고리를 넣거나 바꾸면 출처를 user로 바꾼다.
-- category_source는 authenticated에게 쓰기 권한이 없어 사용자가 직접 쓸 수 없다.
-- 카테고리가 비면(카테고리 삭제의 on delete set null 포함) 누가 바꿨든 출처도 비운다.
create function public.mark_user_category() returns trigger
language plpgsql set search_path = public
as $$
begin
  if new.category_id is null then
    new.category_source := null;
  elsif current_user = 'authenticated'
     and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
    new.category_source := 'user';
  end if;
  return new;
end
$$;

create trigger transactions_mark_user_category
  before insert or update on public.transactions
  for each row execute function public.mark_user_category();

-- ingest_sms: 규칙으로 정한 카테고리는 rule로 기록하고,
-- 취소는 원래 결제의 카테고리·출처를 이어받는다. 나머지는 20261001000300과 같다.
create or replace function public.ingest_sms(
  p_group uuid,
  p_user uuid,
  p_body text,
  p_body_hash text,
  p_source text,
  p_received_at timestamptz,
  p_status text,
  p_parser_id text,
  p_kind text default null,
  p_amount bigint default null,
  p_merchant text default null,
  p_occurred_at timestamptz default null,
  p_issuer text default null
) returns jsonb
language plpgsql set search_path = public
as $$
declare
  v_duplicate boolean;
  v_raw_id uuid;
  v_category_id uuid;
  v_category_source text;
  v_cancels_id uuid;
  v_tx_id uuid;
begin
  -- 같은 사용자의 문자는 하나씩 처리한다 (중복 판정·취소 연결 경쟁 방지)
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  if p_kind = 'approval' then
    -- 같은 승인 문자라도 앞선 승인이 이미 취소됐다면 재승인이다
    select exists (
      select 1 from public.raw_messages r
      where r.user_id = p_user and r.body_hash = p_body_hash
        and not exists (
          select 1
          from public.transactions t
          join public.transactions c on c.cancels_transaction_id = t.id
          where t.raw_message_id = r.id and t.kind = 'approval'
        )
    ) into v_duplicate;
  else
    select exists (
      select 1 from public.raw_messages r
      where r.user_id = p_user and r.body_hash = p_body_hash
    ) into v_duplicate;
  end if;

  if v_duplicate then
    return jsonb_build_object('status', 'duplicate');
  end if;

  insert into public.raw_messages (group_id, user_id, body, body_hash, source, received_at, status, parser_id)
  values (p_group, p_user, p_body, p_body_hash, p_source, p_received_at, p_status, p_parser_id)
  returning id into v_raw_id;

  if p_kind is null then
    return jsonb_build_object('status', p_status);
  end if;

  select category_id into v_category_id
  from public.merchant_rules
  where group_id = p_group and merchant_pattern = p_merchant;
  if v_category_id is not null then
    v_category_source := 'rule';
  end if;

  if p_kind = 'cancel' then
    v_cancels_id := public.find_cancel_target(p_group, p_user, p_amount, p_merchant, p_occurred_at);
    if v_category_id is null and v_cancels_id is not null then
      select category_id, category_source into v_category_id, v_category_source
      from public.transactions where id = v_cancels_id;
    end if;
  end if;

  insert into public.transactions (
    group_id, user_id, raw_message_id, kind, amount, merchant, occurred_at, issuer,
    category_id, category_source, cancels_transaction_id
  ) values (
    p_group, p_user, v_raw_id, p_kind,
    case when p_kind = 'cancel' then -p_amount else p_amount end,
    p_merchant, p_occurred_at, p_issuer, v_category_id, v_category_source, v_cancels_id
  )
  returning id into v_tx_id;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;
