<script setup>
import { computed } from 'vue'
import { cardImage, onImageError } from '../utils/media'
import { useAuth } from '../composables/useAuth'

const props = defineProps({
  article: { type: Object, required: true },
})
const emit = defineEmits(['edit', 'delete'])

const { isAdmin } = useAuth()
const isLyrics = computed(() => props.article.category === 'lyrics')
const cover = computed(() => cardImage(props.article))
</script>

<template>
  <article
    class="group relative flex flex-col overflow-hidden rounded-xl border border-line bg-card transition duration-200 hover:-translate-y-1 hover:border-accent/50 hover:shadow-lg hover:shadow-black/40"
  >
    <!-- ปุ่มแอดมิน -->
    <div v-if="isAdmin" class="absolute right-2 top-2 z-10 flex gap-1.5">
      <button
        type="button"
        class="rounded-md border border-line bg-ink/90 px-2 py-1 text-xs text-body transition hover:border-accent hover:text-accent"
        @click.stop.prevent="emit('edit', article)"
      >
        ✏️ แก้ไข
      </button>
      <button
        type="button"
        class="rounded-md border border-line bg-ink/90 px-2 py-1 text-xs text-danger transition hover:border-danger"
        @click.stop.prevent="emit('delete', article)"
      >
        🗑️ ลบ
      </button>
    </div>

    <RouterLink :to="`/lore/${article.slug || article.id}`" class="flex flex-1 flex-col">
      <!-- ปกบทความเป็นรูปจัตุรัส ส่วนเนื้อเพลงใช้ thumbnail YouTube จึงเป็น 16:9 -->
      <div class="relative overflow-hidden bg-ink" :class="isLyrics ? 'aspect-video' : 'aspect-square'">
        <span
          class="absolute left-2.5 top-2.5 z-[5] rounded-md bg-accent px-2 py-0.5 text-[0.7rem] font-semibold text-ink"
        >
          {{ article.categoryName }}
        </span>
        <img
          :src="cover"
          :alt="article.title"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          @error="onImageError"
        />
      </div>

      <div class="flex flex-1 flex-col p-4">
        <h3 class="line-clamp-2 text-[0.95rem] font-semibold leading-snug text-body group-hover:text-accent">
          {{ article.title }}
        </h3>

        <template v-if="!isLyrics">
          <p class="mt-2 line-clamp-3 flex-1 text-[0.8rem] leading-relaxed text-muted">
            {{ article.summary }}
          </p>
          <div class="mt-4 flex items-center justify-between text-[0.72rem] text-muted">
            <span>{{ article.updated || article.updatedAt || 'ล่าสุด' }}</span>
            <span class="font-semibold text-accent">อ่านต่อ &rarr;</span>
          </div>
        </template>
      </div>
    </RouterLink>
  </article>
</template>
