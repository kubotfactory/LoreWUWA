<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import GlossaryTerm from './GlossaryTerm.vue'
import { extractYouTubeId, youtubeEmbed, toParagraphs, cardImage, onImageError } from '../utils/media'
import { useArticles } from '../composables/useArticles'
import { useGlossary } from '../composables/useGlossary'

const props = defineProps({
  article: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const { relatedTo } = useArticles()
const { tokenize } = useGlossary()

const ytId = computed(() => extractYouTubeId(props.article?.image))

/**
 * เนื้อหา -> ย่อหน้า -> บรรทัด -> ชิ้นข้อความ/คำเฉพาะ
 * ไฮไลต์คำละครั้งต่อหนึ่งย่อหน้าเพื่อไม่ให้อ่านยาก และข้ามคำที่ตรงกับบทความที่กำลังอ่านอยู่
 */
const paragraphs = computed(() => {
  const raw = toParagraphs(props.article?.content)
  const selfTerm = props.article?.title?.split(/[|｜-]/)[0].trim()
  return raw.map((lines) => {
    const used = new Map()
    return lines.map((line) => tokenize(line, used, selfTerm))
  })
})
const tags = computed(() => (props.article?.tags || []).map((t) => String(t).trim()).filter(Boolean))
const related = computed(() => relatedTo(props.article))

// เวลาเด้งจากบทความหนึ่งไปอีกบทความ ให้เลื่อนกลับไปบนสุดของกล่อง
const scrollArea = ref(null)
watch(
  () => props.article?.id,
  async () => {
    await nextTick()
    if (scrollArea.value) scrollArea.value.scrollTop = 0
  },
)
</script>

<template>
  <BaseModal :open="!!article" labelled-by="article-modal-title" @close="emit('close')">
    <div v-if="article" ref="scrollArea" class="max-h-[88vh] overflow-y-auto p-5 sm:p-7">
      <div class="grid gap-5 md:grid-cols-[minmax(0,320px)_1fr]">
        <!-- สื่อ -->
        <div class="overflow-hidden rounded-xl border border-line bg-ink">
          <div v-if="ytId" class="aspect-video">
            <iframe
              class="h-full w-full"
              :src="youtubeEmbed(ytId)"
              :title="article.title"
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            />
          </div>
          <img
            v-else
            :src="article.image"
            :alt="article.title"
            loading="lazy"
            class="aspect-square w-full object-cover"
            @error="onImageError"
          />
        </div>

        <!-- ข้อมูลหัวเรื่อง -->
        <div class="min-w-0 pr-10">
          <h2 id="article-modal-title" class="text-xl font-bold leading-snug text-white sm:text-2xl">
            {{ article.title }}
          </h2>

          <span class="mt-3 inline-block rounded-md bg-accent px-2.5 py-0.5 text-xs font-semibold text-ink">
            {{ article.categoryName }}
          </span>

          <div class="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
            <span>สร้าง: {{ article.createdAt || '-' }}</span>
            <span aria-hidden="true">|</span>
            <span>ล่าสุด: {{ article.updatedAt || '-' }}</span>
          </div>

          <div v-if="tags.length" class="mt-4">
            <p class="mb-2 text-xs text-muted"><span aria-hidden="true">🏷️</span> คำเฉพาะ:</p>
            <div class="flex flex-wrap gap-1.5">
              <RouterLink
                v-for="tag in tags"
                :key="tag"
                :to="`/tag/${encodeURIComponent(tag)}`"
                class="tag-pill"
              >
                {{ tag }}
              </RouterLink>
            </div>
          </div>
        </div>
      </div>

      <!-- เนื้อหา -->
      <div v-if="paragraphs.length" class="mt-7 border-t border-line pt-6">
        <p
          v-for="(para, i) in paragraphs"
          :key="i"
          class="mb-4 text-[0.95rem] leading-[1.9] text-body/90"
        >
          <template v-for="(line, j) in para" :key="j"
            ><template v-for="(chunk, k) in line" :key="k"
              ><GlossaryTerm
                v-if="chunk.entry"
                :text="chunk.text"
                :entry="chunk.entry"
              /><template v-else>{{ chunk.text }}</template></template
            ><br v-if="j < para.length - 1"
          /></template>
        </p>
      </div>

      <!-- บทความที่เกี่ยวข้อง -->
      <div v-if="related.length" class="mt-8 border-t border-line pt-6">
        <h3 class="mb-4 text-sm font-semibold text-accent">📚 บทความที่เกี่ยวข้อง</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <RouterLink
            v-for="rel in related"
            :key="rel.id"
            :to="`/lore/${rel.slug || rel.id}`"
            class="flex gap-3 rounded-lg border border-line bg-ink/60 p-2.5 transition hover:border-accent/50"
          >
            <img
              :src="cardImage(rel)"
              :alt="rel.title"
              loading="lazy"
              class="h-16 w-16 shrink-0 rounded-md object-cover"
              @error="onImageError"
            />
            <div class="min-w-0">
              <p class="line-clamp-2 text-sm font-medium text-body">{{ rel.title }}</p>
              <p class="mt-1 text-[0.7rem] text-muted">{{ rel.categoryName }}</p>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
