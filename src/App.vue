<script setup>
import { onMounted, ref } from 'vue'
import SiteHero from './components/SiteHero.vue'
import SiteFooter from './components/SiteFooter.vue'
import ArticleForm from './components/ArticleForm.vue'
import AuthModal from './components/AuthModal.vue'
import { loadArticles } from './composables/useArticles'
import { loadGlossary } from './composables/useGlossary'
import { useAuth, initializeAuth } from './composables/useAuth'

const { isAdmin, logout } = useAuth()

const showForm = ref(false)
const showAuth = ref(false)
const editing = ref(null)

onMounted(() => {
  initializeAuth()
  loadArticles()
  loadGlossary()
})

function openAdd() {
  editing.value = null
  showForm.value = true
}

function openEdit(article) {
  editing.value = article
  showForm.value = true
}

async function toggleAdmin() {
  if (isAdmin.value) {
    try { await logout() } catch (err) { alert(err.message) }
  } else showAuth.value = true
}
</script>

<template>
  <SiteHero />

  <RouterView v-slot="{ Component }">
    <component :is="Component" @add="openAdd" @edit="openEdit" />
  </RouterView>

  <SiteFooter />

  <ArticleForm :open="showForm" :editing="editing" @close="showForm = false" />
  <AuthModal :open="showAuth" @close="showAuth = false" />

  <button
    type="button"
    class="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-card text-xl shadow-lg transition hover:border-accent hover:text-accent"
    :title="isAdmin ? 'ออกจากโหมด Admin' : 'โหมดแก้ไข (Admin)'"
    :aria-label="isAdmin ? 'ออกจากโหมด Admin' : 'เข้าสู่โหมด Admin'"
    @click="toggleAdmin"
  >
    {{ isAdmin ? '🔒' : '✏️' }}
  </button>
</template>
