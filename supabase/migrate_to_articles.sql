-- Migration: Change storage model from single jsonb row in 'archive' to 'articles' table (1 row per article)
begin;

-- 1. Create articles table
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

-- 2. Enable RLS
alter table public.articles enable row level security;

-- 3. Grants & Policies
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select to anon, authenticated using (true);

drop policy if exists articles_admin_write on public.articles;
create policy articles_admin_write on public.articles for all to authenticated
  using (exists (select 1 from public.archive_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.archive_admins where user_id = auth.uid()));

-- 4. Auto-migrate existing articles from public.archive (if table exists and has data)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'archive') then
    insert into public.articles (id, slug, category, category_name, title, summary, content, image, tags, keywords, created_at, updated_at, updated)
    select
      (a->>'id')::bigint,
      case
        when (a->>'id') = '1786165562305' and (a->>'slug') = 'rover' then 'rover-2'
        else coalesce(nullif(a->>'slug', ''), a->>'id', 'article-' || (a->>'id'))
      end,
      coalesce(nullif(a->>'category', ''), 'main'),
      a->>'categoryName',
      coalesce(nullif(a->>'title', ''), 'Untitled'),
      coalesce(a->>'summary', ''),
      coalesce(a->>'content', ''),
      coalesce(a->>'image', ''),
      coalesce(array(select jsonb_array_elements_text(a->'tags')), '{}'),
      case
        when a ? 'keywords' and jsonb_typeof(a->'keywords') = 'array'
        then array(select jsonb_array_elements_text(a->'keywords'))
        else null
      end,
      a->>'createdAt',
      a->>'updatedAt',
      a->>'updated'
    from public.archive, jsonb_array_elements(articles) as a
    on conflict (id) do update set
      slug = excluded.slug,
      category = excluded.category,
      category_name = excluded.category_name,
      title = excluded.title,
      summary = excluded.summary,
      content = excluded.content,
      image = excluded.image,
      tags = excluded.tags,
      keywords = excluded.keywords,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      updated = excluded.updated,
      updated_time = now();
  end if;
end $$;

commit;
