import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const admin = '00000000-0000-4000-8000-000000000001'
const visitor = '00000000-0000-4000-8000-000000000002'
let db

before(async () => {
  db = new PGlite()
  // Supabase owns these schemas in production. Reproduce its auth identity
  // and storage tables so the actual project SQL can run against PostgreSQL.
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema auth to anon, authenticated;
    create schema storage;
    create table storage.buckets (
      id text primary key, name text, public boolean,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to anon, authenticated;
    insert into auth.users values ('${admin}'), ('${visitor}');
  `)
  await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
  await db.query('insert into public.archive_admins values ($1)', [admin])
})

after(async () => { await db?.close() })

async function asRole(role, user, sql, args = []) {
  assert.ok(['anon', 'authenticated'].includes(role))
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`)
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user || ''])
    return tx.query(sql, args)
  })
}

test('public can read imported articles but cannot write or call the save function', async () => {
  const result = await asRole('anon', null, 'select jsonb_array_length(articles) as count from public.archive')
  assert.equal(result.rows[0].count, 31)
  await assert.rejects(asRole('anon', null, "update public.archive set articles = '[]'"), /permission denied/)
  await assert.rejects(asRole('anon', null, "select public.save_archive('[]', 1)"), /permission denied/)
})

test('ordinary accounts cannot grant themselves admin or save articles', async () => {
  await assert.rejects(asRole('authenticated', visitor,
    'insert into public.archive_admins values ($1)', [visitor]), /permission denied/)
  await assert.rejects(asRole('authenticated', visitor,
    "select public.save_archive('[]', 1)"), /ADMIN_REQUIRED/)
  const result = await asRole('authenticated', visitor, 'select * from public.archive_admins')
  assert.equal(result.rows.length, 0)
})

test('admins save atomically and stale revisions cannot replace newer content', async () => {
  const payload = JSON.stringify([{ id: 1, title: 'ข้อมูลล่าสุด' }])
  const saved = await asRole('authenticated', admin,
    'select public.save_archive($1::jsonb, 1) as revision', [payload])
  assert.equal(saved.rows[0].revision, 2)
  await assert.rejects(asRole('authenticated', admin,
    "select public.save_archive('[]', 1)"), /ARCHIVE_CONFLICT/)
  const result = await asRole('anon', null, 'select articles, revision from public.archive')
  assert.equal(result.rows[0].articles[0].title, 'ข้อมูลล่าสุด')
  assert.equal(result.rows[0].revision, 2)
  await assert.rejects(asRole('authenticated', admin,
    "update public.archive set articles = '[]'"), /permission denied/)
})

test('invalid payloads are rejected without changing the revision', async () => {
  await assert.rejects(asRole('authenticated', admin,
    "select public.save_archive('{}', 2)"), /INVALID_ARTICLES/)
  await assert.rejects(asRole('authenticated', admin,
    'select public.save_archive(null, 2)'), /INVALID_ARTICLES/)
  const result = await db.query('select revision from public.archive')
  assert.equal(result.rows[0].revision, 2)
})

test('only admins may insert covers, and only into the intended bucket', async () => {
  const insert = 'insert into storage.objects (bucket_id, name) values ($1, $2)'
  await assert.rejects(asRole('anon', null, insert, ['article-covers', 'anon.png']), /row-level security/)
  await assert.rejects(asRole('authenticated', visitor, insert, ['article-covers', 'visitor.png']), /row-level security/)
  await asRole('authenticated', admin, insert, ['article-covers', 'admin.png'])
  await assert.rejects(asRole('authenticated', admin, insert, ['another-bucket', 'admin.png']), /row-level security/)
  const config = await db.query("select * from storage.buckets where id = 'article-covers'")
  assert.equal(Number(config.rows[0].file_size_limit), 5242880)
  assert.equal(config.rows[0].allowed_mime_types.includes('image/svg+xml'), false)
})

test('rerunning schema and seed preserves live data and revoked admins cannot save', async () => {
  await db.exec(readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8'))
  await db.exec(readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8'))
  const result = await db.query('select articles, revision from public.archive')
  assert.equal(result.rows[0].articles[0].title, 'ข้อมูลล่าสุด')
  assert.equal(result.rows[0].revision, 2)
  await db.query('delete from public.archive_admins where user_id = $1', [admin])
  await assert.rejects(asRole('authenticated', admin,
    "select public.save_archive('[]', 2)"), /ADMIN_REQUIRED/)
})
