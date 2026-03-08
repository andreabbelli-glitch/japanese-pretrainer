-- Goal and context-exposure user state for canonical language progress.
-- Keeps user_item_progress global by (user_id, item_id).

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text,
  target_type text not null check (target_type in ('game', 'product', 'unit', 'custom')),
  target_id text,
  linked_item_ids text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'archived')),
  priority smallint not null default 3 check (priority between 1 and 5),
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  archive_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (
    (target_type = 'custom' and target_id is null)
    or (target_type <> 'custom' and target_id is not null)
  )
);

create table if not exists public.user_item_context_exposure (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  context_type text not null check (context_type in ('game', 'product', 'unit', 'lesson', 'review', 'goal', 'other')),
  context_id text not null,
  source text not null default 'unknown',
  exposure_count integer not null default 1 check (exposure_count >= 1),
  first_exposed_at timestamptz not null default timezone('utc', now()),
  last_exposed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, item_id, context_type, context_id)
);

create index if not exists user_goals_user_status_priority_idx
  on public.user_goals (user_id, status, priority desc, created_at desc);

create index if not exists user_goals_user_target_idx
  on public.user_goals (user_id, target_type, target_id)
  where archived_at is null;

create index if not exists user_goals_user_created_idx
  on public.user_goals (user_id, created_at desc);

create index if not exists user_item_context_exposure_user_item_idx
  on public.user_item_context_exposure (user_id, item_id, last_exposed_at desc);

create index if not exists user_item_context_exposure_user_context_idx
  on public.user_item_context_exposure (user_id, context_type, context_id, last_exposed_at desc);

create index if not exists user_item_context_exposure_user_created_idx
  on public.user_item_context_exposure (user_id, created_at desc);

drop trigger if exists set_user_goals_updated_at on public.user_goals;

create trigger set_user_goals_updated_at
  before update on public.user_goals
  for each row execute function public.set_updated_at();

drop trigger if exists set_user_item_context_exposure_updated_at on public.user_item_context_exposure;

create trigger set_user_item_context_exposure_updated_at
  before update on public.user_item_context_exposure
  for each row execute function public.set_updated_at();

alter table public.user_goals enable row level security;
alter table public.user_item_context_exposure enable row level security;

drop policy if exists "user_goals_select_own" on public.user_goals;
drop policy if exists "user_goals_insert_own" on public.user_goals;
drop policy if exists "user_goals_update_own" on public.user_goals;
drop policy if exists "user_goals_delete_own" on public.user_goals;

create policy "user_goals_select_own"
  on public.user_goals
  for select
  using (auth.uid() = user_id);

create policy "user_goals_insert_own"
  on public.user_goals
  for insert
  with check (auth.uid() = user_id);

create policy "user_goals_update_own"
  on public.user_goals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_goals_delete_own"
  on public.user_goals
  for delete
  using (auth.uid() = user_id);

drop policy if exists "user_item_context_exposure_select_own" on public.user_item_context_exposure;
drop policy if exists "user_item_context_exposure_insert_own" on public.user_item_context_exposure;
drop policy if exists "user_item_context_exposure_update_own" on public.user_item_context_exposure;
drop policy if exists "user_item_context_exposure_delete_own" on public.user_item_context_exposure;

create policy "user_item_context_exposure_select_own"
  on public.user_item_context_exposure
  for select
  using (auth.uid() = user_id);

create policy "user_item_context_exposure_insert_own"
  on public.user_item_context_exposure
  for insert
  with check (auth.uid() = user_id);

create policy "user_item_context_exposure_update_own"
  on public.user_item_context_exposure
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_item_context_exposure_delete_own"
  on public.user_item_context_exposure
  for delete
  using (auth.uid() = user_id);
