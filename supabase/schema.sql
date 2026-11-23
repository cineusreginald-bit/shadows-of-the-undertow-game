-- Shadow Run · Supabase schema
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to run more than once.

-- 1) LEADERBOARD: public. Anyone can read it and add a row. Nobody can edit or delete from the game.
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  name        text        not null check (char_length(btrim(name)) between 1 and 16),
  time_s      integer     not null check (time_s between 30 and 36000),
  retries     integer     not null check (retries between 0 and 9999),
  created_at  timestamptz not null default now()
);
create index if not exists scores_rank on public.scores (time_s, retries, created_at);

alter table public.scores enable row level security;
drop policy if exists "read scores" on public.scores;
drop policy if exists "post a score" on public.scores;
create policy "read scores"  on public.scores for select to anon, authenticated using (true);
create policy "post a score" on public.scores for insert to anon, authenticated with check (true);
grant select, insert on public.scores to anon, authenticated;

-- 2) PLAY STATS: private. The game can add rows but can never read them. Only you see them, in the dashboard.
create table if not exists public.run_events (
  id          bigint generated always as identity primary key,
  run_id      uuid        not null,
  event       text        not null check (event in ('start', 'chapter', 'caught', 'win', 'quit')),
  chapter     text        check (chapter is null or char_length(chapter) <= 16),
  time_s      integer     check (time_s is null or time_s between 0 and 36000),
  retries     integer     check (retries is null or retries between 0 and 9999),
  device      text        check (device in ('desktop', 'touch')),
  created_at  timestamptz not null default now()
);
create index if not exists run_events_run on public.run_events (run_id, created_at);

alter table public.run_events enable row level security;
drop policy if exists "log an event" on public.run_events;
create policy "log an event" on public.run_events for insert to anon, authenticated with check (true);
revoke all on public.run_events from anon, authenticated;
grant insert on public.run_events to anon, authenticated;

-- 3) YOUR VIEWS of the stats (Table Editor shows these like tables). security_invoker keeps them private.
create or replace view public.run_summary with (security_invoker = true) as
select
  run_id,
  min(created_at)                                             as started_at,
  max(device)                                                 as device,
  bool_or(event = 'win')                                      as finished,
  bool_or(event = 'quit')                                     as quit,
  (array_agg(chapter order by created_at desc) filter (where chapter is not null))[1] as last_chapter,
  max(time_s)                                                 as time_s,
  max(retries)                                                as retries
from public.run_events
group by run_id;

create or replace view public.chapter_funnel with (security_invoker = true) as
select
  chapter,
  count(distinct run_id) filter (where event in ('start', 'chapter')) as runs_reached,
  count(*) filter (where event = 'caught')                             as times_caught
from public.run_events
where chapter is not null
group by chapter
order by runs_reached desc;

revoke all on public.run_summary, public.chapter_funnel from anon, authenticated;
