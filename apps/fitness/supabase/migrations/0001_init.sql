-- FitOS v1: profiles + daily logs, RLS, indexes
create table if not exists profiles (user_id uuid primary key references auth.users(id) on delete cascade, age int, sex text, height_cm numeric, weight_kg numeric, target_kg numeric, lang text default 'en', conditions text[] default '{}', created_at timestamptz default now());
create table if not exists weight_logs (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, date date not null, kg numeric not null, created_at timestamptz default now(), unique(user_id, date));
create table if not exists food_logs (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, date date not null, item text not null, qty text, kcal int, protein_g numeric, created_at timestamptz default now());
create table if not exists water_logs (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, date date not null, ml int not null, created_at timestamptz default now());
create table if not exists activity_logs (id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete cascade, date date not null, steps int default 0, workout_done boolean default false, score int default 0, created_at timestamptz default now(), unique(user_id, date));
create index if not exists idx_logs_user_date on activity_logs (user_id, date);
alter table profiles enable row level security; alter table weight_logs enable row level security;
alter table food_logs enable row level security; alter table water_logs enable row level security; alter table activity_logs enable row level security;
drop policy if exists "own" on profiles; create policy "own" on profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own" on weight_logs; create policy "own" on weight_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own" on food_logs; create policy "own" on food_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own" on water_logs; create policy "own" on water_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own" on activity_logs; create policy "own" on activity_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
