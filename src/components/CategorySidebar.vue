<script setup>
import { useRouter } from 'vue-router'
import { CATEGORIES, ALL_CATEGORY } from '../data/categories'
import { useArticles } from '../composables/useArticles'

defineProps({
  active: { type: String, default: 'all' },
})

const router = useRouter()
const { counts } = useArticles()

const items = [ALL_CATEGORY, ...CATEGORIES]

function go(key) {
  router.push(key === 'all' ? '/' : `/c/${key}`)
}
</script>

<template>
  <aside class="h-fit rounded-xl border border-line bg-panel p-5">
    <h2 class="mb-5 flex items-center gap-2 text-[0.95rem] text-accent">
      <span aria-hidden="true">🌐</span> หมวดหมู่เนื้อหา
    </h2>

    <!-- Desktop: รายการหมวดหมู่ -->
    <ul class="hidden flex-col gap-1 lg:flex">
      <li v-for="item in items" :key="item.key">
        <button
          type="button"
          :aria-current="active === item.key ? 'page' : undefined"
          class="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition"
          :class="
            active === item.key
              ? 'bg-accent/10 font-semibold text-accent'
              : 'text-body hover:bg-white/5 hover:text-accent'
          "
          @click="go(item.key)"
        >
          <span>{{ item.label }}</span>
          <span
            class="min-w-6 rounded-full px-1.5 py-0.5 text-center text-[0.7rem] font-semibold"
            :class="active === item.key ? 'bg-accent text-ink' : 'bg-white/5 text-muted'"
          >
            {{ counts[item.key] ?? 0 }}
          </span>
        </button>
      </li>
    </ul>

    <!-- Mobile: dropdown -->
    <select
      class="form-control lg:hidden"
      :value="active"
      aria-label="เลือกหมวดหมู่"
      @change="go($event.target.value)"
    >
      <option v-for="item in items" :key="item.key" :value="item.key">
        {{ item.label }} ({{ counts[item.key] ?? 0 }})
      </option>
    </select>
  </aside>
</template>
