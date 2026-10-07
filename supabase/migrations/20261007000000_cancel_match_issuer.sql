-- 카드사가 둘 이상(국민·현대)이 되면서, 취소를 결제에 연결할 때 카드사도 같아야 한다.
-- 금액·가맹점이 같아도 다른 카드사의 결제에는 연결하지 않는다(나중 취소, 먼저 온 취소 모두).

create function public.find_cancel_target(
  p_group uuid, p_user uuid, p_amount bigint, p_merchant text, p_at timestamptz, p_issuer text
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
    and t.issuer is not distinct from p_issuer
    and t.occurred_at <= p_at
    and t.occurred_at > p_at - interval '60 days'
    and not exists (
      select 1 from public.transactions c where c.cancels_transaction_id = t.id
    )
  order by t.occurred_at desc
  limit 1
$$;

revoke execute on function public.find_cancel_target(uuid, uuid, bigint, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.find_cancel_target(uuid, uuid, bigint, text, timestamptz, text)
  to service_role;

-- ingest_sms: 위 함수에 카드사를 넘기고, 먼저 온 취소를 찾을 때도 카드사를 비교한다. 나머지는 20261002000200과 같다.
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
    v_cancels_id := public.find_cancel_target(p_group, p_user, p_amount, p_merchant, p_occurred_at, p_issuer);
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
      and c.issuer is not distinct from p_issuer
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
    -- SET의 오른쪽은 모두 바꾸기 전 값을 본다
    update public.transactions
    set cancels_transaction_id = v_tx_id,
        category_id = coalesce(category_id, v_category_id),
        category_source = case when category_id is null then v_category_source else category_source end
    where id = v_early_cancel_id;
  end if;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;

drop function public.find_cancel_target(uuid, uuid, bigint, text, timestamptz);
