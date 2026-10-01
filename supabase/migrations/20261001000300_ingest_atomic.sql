-- 같은 문자도 취소 뒤 재승인이면 다시 저장해야 하므로 원문 해시 unique를 일반 인덱스로 바꾼다.
-- 중복 판정은 ingest_sms 안에서 한다.
alter table public.raw_messages drop constraint raw_messages_user_id_body_hash_key;
create index raw_messages_user_hash on public.raw_messages (user_id, body_hash);

-- 원문 저장·중복 판정·취소 연결·거래 생성을 한 트랜잭션으로 처리한다.
-- 중간에 실패하면 원문도 남지 않으므로 기기가 다시 보내면 정상 처리된다.
create function public.ingest_sms(
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

  if p_kind = 'cancel' then
    v_cancels_id := public.find_cancel_target(p_group, p_user, p_amount, p_merchant, p_occurred_at);
  end if;

  insert into public.transactions (
    group_id, user_id, raw_message_id, kind, amount, merchant, occurred_at, issuer,
    category_id, cancels_transaction_id
  ) values (
    p_group, p_user, v_raw_id, p_kind,
    case when p_kind = 'cancel' then -p_amount else p_amount end,
    p_merchant, p_occurred_at, p_issuer, v_category_id, v_cancels_id
  )
  returning id into v_tx_id;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;

revoke execute on function public.ingest_sms(uuid, uuid, text, text, text, timestamptz, text, text, text, bigint, text, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.ingest_sms(uuid, uuid, text, text, text, timestamptz, text, text, text, bigint, text, timestamptz, text)
  to service_role;
