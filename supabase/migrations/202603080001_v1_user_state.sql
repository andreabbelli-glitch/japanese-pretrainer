-- V1 user-state schema for auth/profile/settings/progress/review/bookmarks.
-- Primary teaching content remains in /content, not in DB.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  ui_language text not null default 'it',
  furigana_default boolean not null default true,
  daily_new_limit integer not null default 10 check (daily_new_limit >= 0 and daily_new_limit <= 200),
  daily_review_goal integer not null default 50 check (daily_review_goal >= 0 and daily_review_goal <= 500),
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text not null,
  status text not null check (status in ('not_started', 'in_progress', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, lesson_id)
);

create table if not exists public.user_item_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning', 'mature')),
  due_at timestamptz,
  last_reviewed_at timestamptz,
  interval_days numeric(8, 2) not null default 0,
  ease_factor numeric(4, 2) not null default 2.50,
  reps integer not null default 0,
  lapses integer not null default 0,
  streak integer not null default 0,
  mastery_score integer not null default 0 check (mastery_score between 0 and 100),
  last_rating text check (last_rating in ('Again', 'Hard', 'Good', 'Easy')),
  content_version text not null default 'v1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, item_id)
);

create table if not exists public.review_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'abandoned')),
  item_count integer not null default 0,
  reviewed_count integer not null default 0,
  again_count integer not null default 0,
  hard_count integer not null default 0,
  good_count integer not null default 0,
  easy_count integer not null default 0,
  content_version text not null default 'v1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null references public.review_sessions (id) on delete cascade,
  item_id text not null,
  rating text not null check (rating in ('Again', 'Hard', 'Good', 'Easy')),
  previous_state text check (previous_state in ('new', 'learning', 'review', 'relearning', 'mature')),
  next_state text check (next_state in ('new', 'learning', 'review', 'relearning', 'mature')),
  interval_days_after numeric(8, 2),
  ease_factor_after numeric(4, 2),
  due_at_after timestamptz,
  response_ms integer,
  content_version text not null default 'v1',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lesson_id text,
  item_id text,
  card_id text,
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    ((case when lesson_id is not null then 1 else 0 end) +
    (case when item_id is not null then 1 else 0 end) +
    (case when card_id is not null then 1 else 0 end)) = 1
  )
);

create table if not exists public.daily_stats_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stat_date date not null,
  reviews_done integer not null default 0,
  again_count integer not null default 0,
  hard_count integer not null default 0,
  good_count integer not null default 0,
  easy_count integer not null default 0,
  lessons_completed integer not null default 0,
  items_studied integer not null default 0,
  total_study_ms integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, stat_date)
);

create unique index if not exists bookmarks_user_lesson_unique
  on public.bookmarks (user_id, lesson_id)
  where lesson_id is not null;

create unique index if not exists bookmarks_user_item_unique
  on public.bookmarks (user_id, item_id)
  where item_id is not null;

create unique index if not exists bookmarks_user_card_unique
  on public.bookmarks (user_id, card_id)
  where card_id is not null;

create index if not exists lesson_progress_user_lesson_idx
  on public.lesson_progress (user_id, lesson_id);

create index if not exists user_item_progress_user_due_idx
  on public.user_item_progress (user_id, due_at);

create index if not exists review_sessions_user_created_idx
  on public.review_sessions (user_id, created_at desc);

create index if not exists review_events_user_created_idx
  on public.review_events (user_id, created_at desc);

create index if not exists review_events_session_created_idx
  on public.review_events (session_id, created_at);

create index if not exists bookmarks_user_created_idx
  on public.bookmarks (user_id, created_at desc);

create index if not exists daily_stats_cache_user_date_idx
  on public.daily_stats_cache (user_id, stat_date desc);

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

create trigger set_lesson_progress_updated_at
  before update on public.lesson_progress
  for each row execute function public.set_updated_at();

create trigger set_user_item_progress_updated_at
  before update on public.user_item_progress
  for each row execute function public.set_updated_at();

create trigger set_review_sessions_updated_at
  before update on public.review_sessions
  for each row execute function public.set_updated_at();

create trigger set_bookmarks_updated_at
  before update on public.bookmarks
  for each row execute function public.set_updated_at();

create trigger set_daily_stats_cache_updated_at
  before update on public.daily_stats_cache
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.user_item_progress enable row level security;
alter table public.review_sessions enable row level security;
alter table public.review_events enable row level security;
alter table public.bookmarks enable row level security;
alter table public.daily_stats_cache enable row level security;

create policy "profiles_select_own"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles_delete_own"
  on public.profiles
  for delete
  using (auth.uid() = id);

create policy "user_settings_select_own"
  on public.user_settings
  for select
  using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings
  for insert
  with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_settings_delete_own"
  on public.user_settings
  for delete
  using (auth.uid() = user_id);

create policy "lesson_progress_select_own"
  on public.lesson_progress
  for select
  using (auth.uid() = user_id);

create policy "lesson_progress_insert_own"
  on public.lesson_progress
  for insert
  with check (auth.uid() = user_id);

create policy "lesson_progress_update_own"
  on public.lesson_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "lesson_progress_delete_own"
  on public.lesson_progress
  for delete
  using (auth.uid() = user_id);

create policy "user_item_progress_select_own"
  on public.user_item_progress
  for select
  using (auth.uid() = user_id);

create policy "user_item_progress_insert_own"
  on public.user_item_progress
  for insert
  with check (auth.uid() = user_id);

create policy "user_item_progress_update_own"
  on public.user_item_progress
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_item_progress_delete_own"
  on public.user_item_progress
  for delete
  using (auth.uid() = user_id);

create policy "review_sessions_select_own"
  on public.review_sessions
  for select
  using (auth.uid() = user_id);

create policy "review_sessions_insert_own"
  on public.review_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "review_sessions_update_own"
  on public.review_sessions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "review_sessions_delete_own"
  on public.review_sessions
  for delete
  using (auth.uid() = user_id);

create policy "review_events_select_own"
  on public.review_events
  for select
  using (auth.uid() = user_id);

create policy "review_events_insert_own"
  on public.review_events
  for insert
  with check (auth.uid() = user_id);

create policy "review_events_update_own"
  on public.review_events
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "review_events_delete_own"
  on public.review_events
  for delete
  using (auth.uid() = user_id);

create policy "bookmarks_select_own"
  on public.bookmarks
  for select
  using (auth.uid() = user_id);

create policy "bookmarks_insert_own"
  on public.bookmarks
  for insert
  with check (auth.uid() = user_id);

create policy "bookmarks_update_own"
  on public.bookmarks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "bookmarks_delete_own"
  on public.bookmarks
  for delete
  using (auth.uid() = user_id);

create policy "daily_stats_cache_select_own"
  on public.daily_stats_cache
  for select
  using (auth.uid() = user_id);

create policy "daily_stats_cache_insert_own"
  on public.daily_stats_cache
  for insert
  with check (auth.uid() = user_id);

create policy "daily_stats_cache_update_own"
  on public.daily_stats_cache
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "daily_stats_cache_delete_own"
  on public.daily_stats_cache
  for delete
  using (auth.uid() = user_id);
