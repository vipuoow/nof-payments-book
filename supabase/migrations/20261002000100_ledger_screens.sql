-- 화면에서 카테고리를 고르면: 그 거래는 user, 가맹점 규칙 저장,
-- 같은 그룹·가맹점·같은 달(KST)의 미지정·ai 거래는 rule로 함께 바꾼다.
-- 미지정(null)으로 되돌리면 그 거래만 바꾸고 규칙은 그대로 둔다. 함께 바뀐 거래 수를 돌려준다.
create function public.set_transaction_category(p_transaction uuid, p_category uuid) returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_group uuid;
  v_merchant text;
  v_at timestamptz;
  v_month_local timestamp;
  v_count int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;

  select group_id, merchant, occurred_at into v_group, v_merchant, v_at
  from public.transactions where id = p_transaction
  for update;
  if v_group is null or v_group is distinct from public.my_group_id() then
    raise exception 'not_allowed';
  end if;
  if not public.is_my_category(p_category) then
    raise exception 'not_allowed';
  end if;

  update public.transactions
  set category_id = p_category,
      category_source = case when p_category is null then null else 'user' end
  where id = p_transaction;

  if p_category is null then
    return 0;
  end if;

  insert into public.merchant_rules (group_id, merchant_pattern, category_id)
  values (v_group, v_merchant, p_category)
  on conflict (group_id, merchant_pattern) do update set category_id = excluded.category_id;

  v_month_local := date_trunc('month', v_at at time zone 'Asia/Seoul');
  update public.transactions
  set category_id = p_category, category_source = 'rule'
  where group_id = v_group
    and merchant = v_merchant
    and id <> p_transaction
    and occurred_at >= (v_month_local at time zone 'Asia/Seoul')
    and occurred_at < ((v_month_local + interval '1 month') at time zone 'Asia/Seoul')
    and (category_source is null or category_source = 'ai');
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

revoke execute on function public.set_transaction_category(uuid, uuid) from public, anon;
grant execute on function public.set_transaction_category(uuid, uuid) to authenticated;

-- ingest_sms: 승인을 저장할 때 먼저 도착한 짝 없는 취소(같은 그룹·사용자·가맹점, 금액 -승인액,
-- 승인 시각 이후 60일 안, 가장 이른 것)를 연결한다. 승인에 카테고리가 없으면 취소의 것을 이어받는다.
-- 나머지는 20261002000000_category_source.sql과 같다.
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
  v_early_cancel_id uuid;
  v_early_category_id uuid;
  v_early_category_source text;
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

  if p_kind = 'approval' then
    select c.id, c.category_id, c.category_source
      into v_early_cancel_id, v_early_category_id, v_early_category_source
    from public.transactions c
    where c.group_id = p_group
      and c.user_id = p_user
      and c.kind = 'cancel'
      and c.cancels_transaction_id is null
      and c.amount = -p_amount
      and c.merchant = p_merchant
      and c.occurred_at >= p_occurred_at
      and c.occurred_at < p_occurred_at + interval '60 days'
    order by c.occurred_at
    limit 1;
    if v_category_id is null and v_early_category_id is not null then
      v_category_id := v_early_category_id;
      v_category_source := v_early_category_source;
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

  if v_early_cancel_id is not null then
    update public.transactions set cancels_transaction_id = v_tx_id where id = v_early_cancel_id;
  end if;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;
