-- 화면 모드(사람마다): 기본(흰색+보라 파스텔) · 밝게 · 어둡게. 처음은 기본.
alter table public.profiles
  add column theme text not null default 'basic'
  constraint profiles_theme_check check (theme in ('basic', 'light', 'dark'));

-- 자기 프로필의 모드만 바꿀 수 있다(행은 profiles_update_self 정책이 막는다)
grant update (theme) on public.profiles to authenticated;
