<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import CategorySidebar from '../components/CategorySidebar.vue'
import ArticleCard from '../components/ArticleCard.vue'
import ArticleModal from '../components/ArticleModal.vue'
import { categoryLabel, SORT_OPTIONS } from '../data/categories'
import { useArticles } from '../composables/useArticles'
import { useAuth } from '../composables/useAuth'
import { useContent } from '../composables/useContent'

const route = useRoute()
const router = useRouter()
const { articles, loading, loadError, search, sortBy, filtered, byIdentifier } = useArticles()
const { isAdmin } = useAuth()
const { deleteArticle } = useContent()

const emit = defineEmits(['add', 'edit'])

const activeCategory = computed(() => route.params.category || 'all')
const activeTag = computed(() => (route.params.tag ? decodeURIComponent(route.params.tag) : null))
const openArticle = computed(() =>
  route.params.slug ? byIdentifier(decodeURIComponent(route.params.slug)) : null,
)

const heading = computed(() =>
  activeTag.value ? `คำเฉพาะ: ${activeTag.value}` : categoryLabel(activeCategory.value),
)

const list = computed(() =>
  filtered({ category: activeCategory.value, tag: activeTag.value }),
)

// อัปเดตชื่อแท็บให้ตรงกับสิ่งที่กำลังดู เวลาแชร์ลิงก์จะได้สื่อความ
watch(
  [openArticle, heading],
  () => {
    const base = "Tethys's Archive"
    document.title = openArticle.value ? `${openArticle.value.title} | ${base}` : `${heading.value} | ${base}`
  },
  { immediate: true },
)

// ถ้า slug ใน URL ไม่มีจริง (โหลดเสร็จแล้วยังหาไม่เจอ) ให้เด้งกลับหน้าแรก
watch([loading, openArticle], ([isLoading, found]) => {
  if (!isLoading && route.params.slug && !found) router.replace('/')
})

function closeArticle() {
  router.push(activeTag.value ? `/tag/${encodeURIComponent(activeTag.value)}` : activeCategory.value === 'all' ? '/' : `/c/${activeCategory.value}`)
}

async function remove(article) {
  if (!confirm(`ลบบทความ "${article.title}" ใช่หรือไม่?`)) return
  try {
    await deleteArticle(article.id)
  } catch (err) {
    alert(err.message || 'ลบไม่สำเร็จ')
  }
}
</script>

<template>
  <div class="mx-auto mt-8 grid w-[95%] max-w-[1800px] gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
    <CategorySidebar :active="activeTag ? '' : activeCategory" />

    <main class="min-w-0">
      <div class="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div class="min-w-0">
          <h2 class="truncate text-xl font-bold text-white">{{ heading }}</h2>
          <p class="mt-0.5 text-xs text-accent">คุย Lore ไม่คุย Leak</p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            v-model="search"
            type="search"
            class="form-control sm:w-72"
            placeholder="ค้นหาชื่อบทความ, เนื้อหา, หรือแท็ก..."
            aria-label="ค้นหาบทความ"
          />
          <select v-model="sortBy" class="form-control sm:w-52" aria-label="เรียงลำดับ">
            <option v-for="o in SORT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
          <button v-if="isAdmin" type="button" class="btn-primary whitespace-nowrap" @click="emit('add')">
            + เพิ่มบทความ
          </button>
        </div>
      </div>

      <!-- สถานะโหลด -->
      <div v-if="loading" class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        <div v-for="n in 6" :key="n" class="animate-pulse overflow-hidden rounded-xl border border-line bg-card">
          <div class="bg-white/5" :class="activeCategory === 'lyrics' ? 'aspect-video' : 'aspect-square'" />
          <div class="space-y-2 p-4">
            <div class="h-4 w-3/4 rounded bg-white/5" />
            <div class="h-3 w-full rounded bg-white/5" />
            <div class="h-3 w-2/3 rounded bg-white/5" />
          </div>
        </div>
      </div>

      <p v-else-if="loadError" class="rounded-xl border border-danger/40 bg-danger/10 p-6 text-center text-danger">
        {{ loadError }}
      </p>

      <p v-else-if="!list.length" class="py-16 text-center text-muted">ไม่พบบทความที่ค้นหา</p>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        <ArticleCard
          v-for="article in list"
          :key="article.id"
          :article="article"
          @edit="emit('edit', $event)"
          @delete="remove"
        />
      </div>
    </main>
  </div>

  <ArticleModal :article="openArticle" @close="closeArticle" @edit="emit('edit', $event)" />
</template>
