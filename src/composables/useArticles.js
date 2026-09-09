import { ref, computed } from 'vue'
import { CATEGORIES } from '../data/categories'
import { supabase } from '../lib/supabase'
import { createArchiveStore } from '../services/archiveStore'

// ---- state กลาง (singleton) — import ที่ไหนก็ได้ข้อมูลชุดเดียวกัน ----
const articles = ref([])
const revision = ref(null)
const loading = ref(true)
const loadError = ref('')
const search = ref('')
const sortBy = ref('date-new')

let loadPromise = null

export async function loadArticles(force = false) {
  if (loadPromise && !force) return loadPromise
  loading.value = true
  loadError.value = ''
  loadPromise = (async () => {
    try {
      if (supabase) {
        const archive = await createArchiveStore(supabase).load()
        articles.value = archive.articles
        revision.value = archive.revision
        return
      }
      // A checkout without a backend remains readable, but cannot be edited.
      const res = await fetch(`/articles.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      articles.value = Array.isArray(data) ? data : []
      revision.value = null
    } catch (err) {
      console.error('โหลด articles.json ไม่สำเร็จ:', err)
      loadError.value = 'โหลดข้อมูลบทความไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง'
      articles.value = []
      revision.value = null
    } finally {
      loading.value = false
    }
  })()
  return loadPromise
}

export function useArticles() {
  /** จำนวนบทความต่อหมวด — 'ทั้งหมด' ไม่นับเนื้อเพลงตามพฤติกรรมเดิม */
  const counts = computed(() => {
    const out = { all: articles.value.filter((a) => a.category !== 'lyrics').length }
    for (const c of CATEGORIES) {
      out[c.key] = articles.value.filter((a) => a.category === c.key).length
    }
    return out
  })

  const allTags = computed(() => {
    const map = new Map()
    for (const a of articles.value) {
      for (const raw of a.tags || []) {
        const tag = String(raw).trim()
        if (!tag) continue
        map.set(tag.toLowerCase(), { tag, count: (map.get(tag.toLowerCase())?.count || 0) + 1 })
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
  })

  function byIdentifier(identifier) {
    if (!identifier) return null
    const key = String(identifier)
    return (
      articles.value.find((a) => a.slug === key) ||
      articles.value.find((a) => String(a.id) === key) ||
      null
    )
  }

  /** บทความที่เกี่ยวข้อง — จัดอันดับจากจำนวน tag ที่ตรงกัน แล้วค่อยดูหมวดเดียวกัน */
  function relatedTo(article, limit = 4) {
    if (!article) return []
    const own = new Set((article.tags || []).map((t) => String(t).trim().toLowerCase()))
    return articles.value
      .filter((a) => a.id !== article.id)
      .map((a) => {
        const shared = (a.tags || []).filter((t) => own.has(String(t).trim().toLowerCase())).length
        return { article: a, score: shared * 10 + (a.category === article.category ? 1 : 0) }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.article.id - a.article.id)
      .slice(0, limit)
      .map((x) => x.article)
  }

  /** กรอง + เรียง ตามหมวด / แท็ก / คำค้น */
  function filtered({ category = 'all', tag = null } = {}) {
    const keyword = search.value.toLowerCase().trim()

    let list = articles.value.filter((a) => {
      const matchCategory = tag
        ? true
        : category === 'all'
          ? a.category !== 'lyrics'
          : a.category === category

      const matchTag = !tag || (a.tags || []).some((t) => String(t).trim().toLowerCase() === tag.toLowerCase())

      const matchSearch =
        !keyword ||
        a.title?.toLowerCase().includes(keyword) ||
        a.summary?.toLowerCase().includes(keyword) ||
        a.content?.toLowerCase().includes(keyword) ||
        (a.tags || []).some((t) => String(t).toLowerCase().includes(keyword))

      return matchCategory && matchTag && matchSearch
    })

    const dir = sortBy.value
    list = [...list].sort((a, b) => {
      if (dir === 'name-asc') return a.title.localeCompare(b.title, 'th', { sensitivity: 'base' })
      if (dir === 'name-desc') return b.title.localeCompare(a.title, 'th', { sensitivity: 'base' })
      if (dir === 'date-old') return (a.id || 0) - (b.id || 0)
      return (b.id || 0) - (a.id || 0)
    })

    return list
  }

  return {
    articles,
    revision,
    loading,
    loadError,
    search,
    sortBy,
    counts,
    allTags,
    filtered,
    byIdentifier,
    relatedTo,
    loadArticles,
  }
}
