-- 在 Supabase 專案的 SQL Editor 貼上並執行一次即可
create table if not exists public.player_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

-- 每個玩家只能讀寫自己的存檔
create policy "read own save" on public.player_saves
  for select using (auth.uid() = user_id);
create policy "insert own save" on public.player_saves
  for insert with check (auth.uid() = user_id);
create policy "update own save" on public.player_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "delete own save" on public.player_saves
  for delete using (auth.uid() = user_id);
