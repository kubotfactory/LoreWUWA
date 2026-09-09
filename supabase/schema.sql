-- Run in the SQL Editor of a new Supabase project, then run seed.sql.
begin;

create table if not exists public.archive (
  id integer primary key check (id = 1),
  articles jsonb not null check (jsonb_typeof(articles) = 'array'),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.archive_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.archive enable row level security;
alter table public.archive_admins enable row level security;
revoke all on public.archive, public.archive_admins from public, anon, authenticated;
grant select on public.archive to anon, authenticated;
grant select on public.archive_admins to authenticated;

drop policy if exists archive_public_read on public.archive;
create policy archive_public_read on public.archive for select to anon, authenticated using (true);
drop policy if exists archive_admin_self_read on public.archive_admins;
create policy archive_admin_self_read on public.archive_admins for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.articles (
  id bigint primary key,
  slug text unique not null,
  category text not null,
  category_name text,
  title text not null,
  summary text not null default '',
  content text not null default '',
  image text not null default '',
  tags text[] not null default '{}',
  keywords text[] default null,
  created_at text,
  updated_at text,
  updated text,
  created_time timestamptz not null default now(),
  updated_time timestamptz not null default now()
);

alter table public.articles enable row level security;
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select to anon, authenticated using (true);

drop policy if exists articles_admin_write on public.articles;
create policy articles_admin_write on public.articles for all to authenticated
  using (exists (select 1 from public.archive_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.archive_admins where user_id = auth.uid()));

-- Clients cannot write the table directly. This function checks membership
-- and compares the revision in the same UPDATE that commits the new data.
create or replace function public.save_archive(p_articles jsonb, p_expected_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  next_revision integer;
begin
  if not exists (select 1 from public.archive_admins where user_id = auth.uid()) then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if p_articles is null or jsonb_typeof(p_articles) <> 'array' then
    raise exception 'INVALID_ARTICLES' using errcode = '22023';
  end if;

  update public.archive
    set articles = p_articles, revision = revision + 1, updated_at = now()
    where id = 1 and revision = p_expected_revision
    returning revision into next_revision;
  if not found then
    raise exception 'ARCHIVE_CONFLICT' using errcode = '40001';
  end if;
  return next_revision;
end;
$$;
revoke all on function public.save_archive(jsonb, integer) from public, anon, authenticated;
grant execute on function public.save_archive(jsonb, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-covers', 'article-covers', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists archive_cover_upload on storage.objects;
create policy archive_cover_upload on storage.objects for insert to authenticated
  with check (
    bucket_id = 'article-covers'
    and exists (select 1 from public.archive_admins where user_id = (select auth.uid()))
  );
-- Existing covers are immutable. New uploads use a UUID, with upsert disabled.
commit;
