-- Want list: tables, access rules and photo storage. Run once in Supabase → SQL Editor.
create table if not exists public.cards    (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.discover (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.layouts  (id text primary key, data jsonb not null, updated_at timestamptz not null default now());
create table if not exists public.editors  (email text primary key);

-- Who can edit (lowercase emails). Add more later with: insert into public.editors values ('someone@example.com');
insert into public.editors (email) values ('__ASHTON_EMAIL__'), ('__WIFE_EMAIL__') on conflict do nothing;

create or replace function public.is_editor() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.editors where email = lower(auth.jwt() ->> 'email')) $$;

alter table public.cards    enable row level security;
alter table public.discover enable row level security;
alter table public.layouts  enable row level security;
alter table public.editors  enable row level security;

do $$ declare t text; begin
  foreach t in array array['cards','discover','layouts'] loop
    execute format('drop policy if exists "anyone can read" on public.%I', t);
    execute format('drop policy if exists "editors can write" on public.%I', t);
    execute format('create policy "anyone can read" on public.%I for select using (true)', t);
    execute format('create policy "editors can write" on public.%I for all to authenticated using (public.is_editor()) with check (public.is_editor())', t);
  end loop;
end $$;
drop policy if exists "see own editor row" on public.editors;
create policy "see own editor row" on public.editors for select to authenticated using (email = lower(auth.jwt() ->> 'email'));

-- Live updates between phones
do $$ begin
  begin alter publication supabase_realtime add table public.cards;    exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.discover; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.layouts;  exception when duplicate_object then null; end;
end $$;

-- Card photos
insert into storage.buckets (id, name, public) values ('photos', 'photos', true) on conflict (id) do nothing;
drop policy if exists "editors upload photos" on storage.objects;
create policy "editors upload photos" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_editor());
