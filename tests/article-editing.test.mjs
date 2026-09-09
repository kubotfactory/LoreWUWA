import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createServer } from 'vite'
import { createRenderer, nextTick, reactive, ssrContextKey } from 'vue'
import { createArchiveStore } from '../src/services/archiveStore.js'

let server, state, content, auth, ArticleForm, initializeAuth, authListener
let remote, revision, writes, failure, member, authError
const initial = [{
  id: 1, slug: 'permanent-link', title: 'Original Title', category: 'main',
  summary: 'คำอธิบายภาษาไทย', content: 'เนื้อหาภาษาไทย', image: '/cover.jpg', tags: [],
}]

before(async () => {
  globalThis.__archiveTestClient = {
    from: (table) => ({ select() { return this }, eq() { return this },
      single: async () => ({ data: { articles: remote, revision }, error: failure }),
      maybeSingle: async () => ({ data: member ? { user_id: 'admin' } : null, error: null }),
    }),
    rpc: async (_name, args) => {
      writes.push(args)
      if (failure) return { error: failure }
      if (args.p_expected_revision !== revision) return { error: { message: 'ARCHIVE_CONFLICT' } }
      remote = structuredClone(args.p_articles)
      return { data: ++revision, error: null }
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'admin', email: 'admin@example.com' } } } }),
      onAuthStateChange: (callback) => { authListener = callback },
      signInWithPassword: async () => ({ data: { session: { user: { id: 'admin', email: 'admin@example.com' } } }, error: authError }),
      signOut: async () => ({ error: null }),
    },
  }
  server = await createServer({
    server: { middlewareMode: true }, appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: 'test-backend', enforce: 'pre',
      resolveId: (id) => id.endsWith('/lib/supabase') ? '\0test-backend' : null,
      load: (id) => id === '\0test-backend'
        ? 'export const supabase = globalThis.__archiveTestClient; export const backendConfigured = true;'
        : null,
    }],
  })
  state = (await server.ssrLoadModule('/src/composables/useArticles.js')).useArticles()
  content = (await server.ssrLoadModule('/src/composables/useContent.js')).useContent()
  const authModule = await server.ssrLoadModule('/src/composables/useAuth.js')
  auth = authModule.useAuth()
  initializeAuth = authModule.initializeAuth
  ArticleForm = (await server.ssrLoadModule('/src/components/ArticleForm.vue')).default
})

beforeEach(() => {
  state.articles.value = structuredClone(initial)
  state.loading.value = false
  state.loadError.value = ''
  state.revision.value = 1
  auth.isAdmin.value = true
  remote = structuredClone(initial)
  revision = 1
  writes = []
  failure = null
  authError = null
  member = true
})

after(async () => {
  await server?.close()
  delete globalThis.__archiveTestClient
})

test('stale edits cannot overwrite newer remote articles', async () => {
  remote.push({ id: 2, title: 'New remote article' })
  revision++
  await assert.rejects(content.saveArticles([]), /รีเฟรช/)
  assert.equal(remote.length, 2)
  assert.deepEqual(state.articles.value, initial)
  assert.equal(state.revision.value, 1)
})

test('successful saves update both data and revision for subsequent saves', async () => {
  const edited = [{ ...initial[0], summary: 'แก้ไขภาษาไทย' }]
  await content.saveArticles(edited)
  assert.deepEqual(state.articles.value, edited)
  assert.equal(state.revision.value, 2)
  await content.saveArticles([])
  assert.deepEqual(remote, [])
  assert.equal(state.revision.value, 3)
})

test('failed saves do not advance the local data or revision', async () => {
  failure = { message: 'Network failure' }
  await assert.rejects(content.saveArticles([]), /Network/)
  assert.deepEqual(state.articles.value, initial)
  assert.equal(state.revision.value, 1)
})

test('loading failures and missing sessions block saving', async () => {
  state.loading.value = true
  await assert.rejects(content.saveArticles([]))
  state.loading.value = false
  state.loadError.value = 'Failed'
  await assert.rejects(content.saveArticles([]))
  state.loadError.value = ''
  auth.isAdmin.value = false
  await assert.rejects(content.saveArticles([]))
  assert.equal(writes.length, 0)
})

test('loads live data and does not fall back to stale files on a backend error', async () => {
  remote = [{ ...initial[0], summary: 'Live summary' }]
  revision = 9
  await state.loadArticles(true)
  assert.equal(state.articles.value[0].summary, 'Live summary')
  assert.equal(state.revision.value, 9)
  failure = { message: 'Database offline' }
  const originalError = console.error
  console.error = () => {}
  try { await state.loadArticles(true) } finally { console.error = originalError }
  assert.ok(state.loadError.value)
  assert.equal(state.revision.value, null)
})

test('only approved accounts enter admin mode', async () => {
  auth.isAdmin.value = false
  member = false
  assert.equal((await auth.login('user@example.com', 'password')).ok, false)
  assert.equal(auth.isAdmin.value, false)
  member = true
  assert.equal((await auth.login('admin@example.com', 'password')).ok, true)
  assert.equal(auth.isAdmin.value, true)
  await auth.logout()
  assert.equal(auth.isAdmin.value, false)
  authError = { message: 'Invalid credentials' }
  assert.equal((await auth.login('admin@example.com', 'wrong')).ok, false)
})

test('restores an approved session and ignores queued sign-in work after sign-out', async () => {
  auth.isAdmin.value = false
  await initializeAuth()
  assert.equal(auth.isAdmin.value, true)
  authListener('SIGNED_IN', { user: { id: 'admin', email: 'admin@example.com' } })
  authListener('SIGNED_OUT', null)
  await new Promise((resolve) => setTimeout(resolve, 5))
  assert.equal(auth.isAdmin.value, false)
  assert.equal(auth.email.value, '')
})

test('unconfigured backend cannot save; upload rejects unsupported and oversized files', async () => {
  const store = createArchiveStore(null)
  await assert.rejects(store.save([], 1))
  await assert.rejects(store.uploadImage({ type: 'image/svg+xml', size: 10 }), /JPG/)
  await assert.rejects(store.uploadImage({ type: 'image/png', size: 6 * 1024 * 1024 }), /5MB/)
})

test('cover uploads use immutable unique paths and return a public URL', async () => {
  const paths = []
  const store = createArchiveStore({ storage: { from: (name) => {
    assert.equal(name, 'article-covers')
    return {
      upload: async (path, _file, options) => { paths.push(path); assert.equal(options.upsert, false); return {} },
      getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.example/${path}` } }),
    }
  } } })
  const file = { type: 'image/png', size: 100 }
  assert.match(await store.uploadImage(file), /^https:\/\/storage.example\/cover_.*\.png$/)
  await store.uploadImage(file)
  assert.notEqual(paths[0], paths[1])
})

// Exercise the real form watcher and submit without a browser or external writes.
async function withForm(editing, run) {
  let form
  const props = reactive({ open: false, editing })
  const renderer = createRenderer({
    createComment: () => ({}), insert() {}, remove() {}, parentNode() {}, nextSibling() {},
  })
  const app = renderer.createApp({
    setup() {
      form = ArticleForm.setup(props, { expose() {}, emit() {} })
      return () => null
    },
  })
  app.provide(ssrContextKey, {})
  app.mount({})
  try {
    props.open = true
    await nextTick()
    await run(form)
  } finally { app.unmount() }
}

test('changing a title preserves its URL', async () => {
  await withForm(state.articles.value[0], async ({ form, submit, error }) => {
    form.value.title = 'Completely Different Title'
    await submit()
    assert.equal(error.value, '')
    assert.equal(remote[0].title, 'Completely Different Title')
    assert.equal(remote[0].slug, 'permanent-link')
  })
})

test('saving the existing Thai/Japanese title preserves its migrated URL', async () => {
  const articles = JSON.parse(readFileSync(new URL('../public/articles.json', import.meta.url), 'utf8'))
  const article = articles.find((a) => a.title.startsWith('風の在り処'))
  assert.ok(article)
  state.articles.value = [article]
  remote = structuredClone([article])
  await withForm(article, async ({ submit, error }) => {
    await submit()
    assert.equal(error.value, '')
    assert.equal(remote[0].slug, article.slug)
  })
})

test('disabled, automatic, and explicit keywords survive an unrelated edit', async () => {
  for (const keywords of [[], undefined, ['Custom', 'Alias']]) {
    const article = { ...initial[0], ...(keywords === undefined ? {} : { keywords }) }
    state.articles.value = [article]
    remote = structuredClone([article])
    await withForm(article, async ({ form, submit, error }) => {
      form.value.summary = 'Unrelated summary edit'
      await submit()
      assert.equal(error.value, '')
      assert.deepEqual(remote[0].keywords, keywords)
    })
  }
})

test('new articles still receive unique URLs', async () => {
  await withForm(null, async ({ form, submit, error }) => {
    Object.assign(form.value, {
      title: 'Permanent Link', image: '/cover.jpg', summary: 'New summary', content: 'New content',
    })
    await submit()
    assert.equal(error.value, '')
    assert.equal(remote[0].slug, 'permanent-link-2')
    assert.equal(remote[1].slug, 'permanent-link')
  })
})
