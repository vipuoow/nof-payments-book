-- 설정값
create table public.app_settings (
  key text primary key,
  value jsonb not null
);

insert into public.app_settings (key, value) values
  ('max_group_members', '2'),
  ('max_users', '30'),
  ('invite_ttl_days', '7'),
  ('raw_message_retention_days', '365'),
  ('budget_warning_ratio', '0.8');

-- 사용자
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  is_operator boolean not null default false,
  can_create_group boolean not null default false,
  created_at timestamptz not null default now()
);

-- 그룹
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (user_id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null unique references public.profiles (user_id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 초대 (수락 로직은 계획 2)
create table public.service_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_by uuid not null references public.profiles (user_id),
  expires_at timestamptz not null,
  used_by uuid references public.profiles (user_id),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  token_hash text not null unique,
  created_by uuid not null references public.profiles (user_id),
  expires_at timestamptz not null,
  used_by uuid references public.profiles (user_id),
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- 기기 전송 토큰
create table public.ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  token_hash text not null unique,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- 카테고리
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups (id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

insert into public.categories (group_id, name, sort_order) values
  (null, '식비', 1), (null, '카페', 2), (null, '편의점', 3),
  (null, '교통', 4), (null, '쇼핑', 5), (null, '생활', 6),
  (null, '의료', 7), (null, '문화', 8), (null, '기타', 9);

create table public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  merchant_pattern text not null,
  category_id uuid not null references public.categories (id) on delete cascade,
  unique (group_id, merchant_pattern)
);

-- 문자 원문과 거래
create table public.raw_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  body text not null,
  body_hash text not null,
  source text not null,
  received_at timestamptz not null,
  status text not null check (status in ('parsed', 'unparsed', 'ignored')),
  parser_id text,
  created_at timestamptz not null default now(),
  unique (user_id, body_hash)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id),
  raw_message_id uuid references public.raw_messages (id) on delete set null,
  kind text not null check (kind in ('approval', 'cancel', 'manual')),
  amount bigint not null,
  merchant text not null,
  occurred_at timestamptz not null,
  issuer text,
  category_id uuid references public.categories (id) on delete set null,
  cancels_transaction_id uuid references public.transactions (id) on delete set null,
  memo text not null default '',
  created_at timestamptz not null default now()
);

-- 승인 하나에는 취소 하나만 연결된다
create unique index transactions_one_cancel_per_approval
  on public.transactions (cancels_transaction_id)
  where cancels_transaction_id is not null;

create index transactions_group_occurred on public.transactions (group_id, occurred_at desc);

-- 예산 (month는 해당 월 1일)
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount bigint not null check (amount > 0),
  unique nulls not distinct (group_id, category_id, month)
);
