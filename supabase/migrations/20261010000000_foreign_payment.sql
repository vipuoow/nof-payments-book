-- 해외 결제: 외화 칸, 날짜별 환율 표, 해외 결제 금액 고치기 허용, ingest_sms 외화 인자와 해외 취소 짝짓기.

alter table public.transactions
  add column currency text check (currency ~ '^[A-Z]{3}$'),
  add column foreign_amount numeric check (foreign_amount > 0),
  add column fx_rate numeric check (fx_rate > 0),
  add column amount_estimated boolean not null default false,
  add constraint transactions_foreign_pair check ((currency is null) = (foreign_amount is null));

create table public.fx_rates (
  date date primary key,
  base text not null,
  rates jsonb not null,
  fetched_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy fx_rates_read on public.fx_rates for select to authenticated using (true);
revoke insert, update, delete on public.fx_rates from anon, authenticated;

-- 카드 거래 보호: 해외 결제(approval, currency 있음)의 금액만 바꿀 수 있고, 바꾸면 예상 표시를 끈다.
-- 외화 칸은 아무도(앱 사용자) 바꿀 수 없다.
create or replace function public.guard_card_transaction()
returns trigger
language plpgsql
as $$
begin
  if current_user <> 'authenticated' or old.kind = 'manual' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'card_tx_locked' using errcode = '42501';
  end if;
  if new.amount is distinct from old.amount then
    if old.currency is null or old.kind <> 'approval' or new.amount <= 0 then
      raise exception 'card_tx_locked' using errcode = '42501';
    end if;
    new.amount_estimated := false;
  end if;
  if new.merchant is distinct from old.merchant
     or new.occurred_at is distinct from old.occurred_at or new.user_id is distinct from old.user_id
     or new.kind is distinct from old.kind or new.currency is distinct from old.currency
     or new.foreign_amount is distinct from old.foreign_amount or new.fx_rate is distinct from old.fx_rate
     or (new.amount_estimated is distinct from old.amount_estimated and new.amount is not distinct from old.amount) then
    raise exception 'card_tx_locked' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop function public.ingest_sms(uuid, uuid, text, text, text, timestamptz, text, text, text, bigint, text, timestamptz, text);

-- 20261007000000_cancel_match_issuer.sql의 ingest_sms에 외화 인자 4개를 더했다.
-- 해외 취소(p_currency 있음)는 원화 대신 통화·외화 금액으로 짝을 찾고, 짝의 지금 원화를 쓴다.
create function public.ingest_sms(
  p_group uuid, p_user uuid, p_body text, p_body_hash text, p_source text, p_received_at timestamptz,
  p_status text, p_parser_id text,
  p_kind text default null, p_amount bigint default null, p_merchant text default null,
  p_occurred_at timestamptz default null, p_issuer text default null,
  p_currency text default null, p_foreign_amount numeric default null,
  p_fx_rate numeric default null, p_amount_estimated boolean default false
) returns jsonb
language plpgsql set search_path = public
as $$
declare
  v_duplicate boolean;
  v_raw_id uuid;
  v_category_id uuid;
  v_category_source text;
  v_cancels_id uuid;
  v_amount bigint := p_amount;
  v_early_cancel_id uuid;
  v_early_category_id uuid;
  v_early_category_source text;
  v_tx_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));

  if p_kind = 'approval' then
    select exists (
      select 1 from public.raw_messages r
      where r.user_id = p_user and r.body_hash = p_body_hash
        and not exists (
          select 1 from public.transactions t
          join public.transactions c on c.cancels_transaction_id = t.id
          where t.raw_message_id = r.id and t.kind = 'approval'
        )
    ) into v_duplicate;
  else
    select exists (
      select 1 from public.raw_messages r where r.user_id = p_user and r.body_hash = p_body_hash
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
  from public.merchant_rules where group_id = p_group and merchant_pattern = p_merchant;
  if v_category_id is not null then
    v_category_source := 'rule';
  end if;

  if p_kind = 'cancel' then
    if p_currency is null then
      v_cancels_id := public.find_cancel_target(p_group, p_user, p_amount, p_merchant, p_occurred_at, p_issuer);
    else
      select t.id, t.amount into v_cancels_id, v_amount
      from public.transactions t
      where t.group_id = p_group and t.user_id = p_user and t.kind = 'approval'
        and t.currency = p_currency and t.foreign_amount = p_foreign_amount
        and t.merchant = p_merchant and t.issuer is not distinct from p_issuer
        and t.occurred_at <= p_occurred_at and t.occurred_at > p_occurred_at - interval '60 days'
        and not exists (select 1 from public.transactions c where c.cancels_transaction_id = t.id)
      order by t.occurred_at desc
      limit 1;
      v_amount := coalesce(v_amount, p_amount);
    end if;
    if v_category_id is null and v_cancels_id is not null then
      select category_id, category_source into v_category_id, v_category_source
      from public.transactions where id = v_cancels_id;
    end if;
  end if;

  if p_kind = 'approval' then
    select c.id, c.category_id, c.category_source
      into v_early_cancel_id, v_early_category_id, v_early_category_source
    from public.transactions c
    where c.group_id = p_group and c.user_id = p_user and c.kind = 'cancel'
      and c.cancels_transaction_id is null
      and c.merchant = p_merchant and c.issuer is not distinct from p_issuer
      and c.occurred_at >= p_occurred_at and c.occurred_at < p_occurred_at + interval '60 days'
      and case when p_currency is null
            then c.currency is null and c.amount = -p_amount
            else c.currency = p_currency and c.foreign_amount = p_foreign_amount end
    order by c.occurred_at
    limit 1;
    if v_category_id is null and v_early_category_id is not null then
      v_category_id := v_early_category_id;
      v_category_source := v_early_category_source;
    end if;
  end if;

  insert into public.transactions (
    group_id, user_id, raw_message_id, kind, amount, merchant, occurred_at, issuer,
    category_id, category_source, cancels_transaction_id,
    currency, foreign_amount, fx_rate, amount_estimated
  ) values (
    p_group, p_user, v_raw_id, p_kind,
    case when p_kind = 'cancel' then -v_amount else v_amount end,
    p_merchant, p_occurred_at, p_issuer, v_category_id, v_category_source, v_cancels_id,
    p_currency, p_foreign_amount, p_fx_rate, coalesce(p_amount_estimated, false)
  )
  returning id into v_tx_id;

  if v_early_cancel_id is not null then
    update public.transactions
    set cancels_transaction_id = v_tx_id,
        amount = case when p_currency is null then amount else -v_amount end,
        category_id = coalesce(category_id, v_category_id),
        category_source = case when category_id is null then v_category_source else category_source end
    where id = v_early_cancel_id;
  end if;

  return jsonb_build_object('status', p_status, 'transaction_id', v_tx_id);
end
$$;

revoke execute on function public.ingest_sms(uuid, uuid, text, text, text, timestamptz, text, text, text, bigint, text, timestamptz, text, text, numeric, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.ingest_sms(uuid, uuid, text, text, text, timestamptz, text, text, text, bigint, text, timestamptz, text, text, numeric, numeric, boolean)
  to service_role;
