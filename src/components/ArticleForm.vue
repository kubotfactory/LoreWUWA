<script setup>
import { computed, ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import { CATEGORIES, categoryLabel } from '../data/categories'
import { uniqueSlug } from '../utils/media'
import { useArticles } from '../composables/useArticles'
import { useContent } from '../composables/useContent'

const props = defineProps({
  open: { type: Boolean, default: false },
  editing: { type: Object, default: null },
})
const emit = defineEmits(['close', 'saved'])

const { articles } = useArticles()
const { uploadImage, saveArticle } = useContent()

const form = ref(blank())
const file = ref(null)
const filePreview = ref('')
const saving = ref(false)
const status = ref('')
const error = ref('')

function blank() {
  return { id: null, title: '', category: 'main', image: '', tags: '', keywords: '', summary: '', content: '' }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    error.value = ''
    status.value = ''
    file.value = null
    filePreview.value = ''
    form.value = props.editing
      ? {
          id: props.editing.id,
          title: props.editing.title,
          category: props.editing.category,
          image: props.editing.image,
          tags: (props.editing.tags || []).join(', '),
          keywords: Array.isArray(props.editing.keywords)
            ? props.editing.keywords.length ? props.editing.keywords.join(', ') : '-'
            : '',
          summary: props.editing.summary,
          content: props.editing.content,
        }
      : blank()
  },
)

const isEdit = computed(() => !!form.value.id)

function onFileChange(e) {
  const f = e.target.files?.[0]
  file.value = f || null
  filePreview.value = f ? URL.createObjectURL(f) : ''
}

/** Tab ในช่องเนื้อหา = ย่อหน้า 4 ช่อง แทนการกระโดดออกจากช่อง */
function onContentTab(e) {
  e.preventDefault()
  const el = e.target
  const { selectionStart: s, selectionEnd: en, value } = el
  el.value = value.slice(0, s) + '    ' + value.slice(en)
  el.selectionStart = el.selectionEnd = s + 4
  form.value.content = el.value
}

async function submit() {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    let image = form.value.image.trim()

    if (file.value) {
      status.value = 'กำลังอัปโหลดรูปปก...'
      image = await uploadImage(file.value)
    }
    if (!image) throw new Error('กรุณาใส่รูปปกหรือลิงก์ YouTube')

    const today = new Date().toLocaleDateString('th-TH')
    const tags = form.value.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    // ปล่อยว่าง = ให้ระบบเดาจากชื่อบทความเอง / ใส่ "-" = ไม่ต้องลิงก์คำไหนเลย
    const rawKeywords = form.value.keywords.trim()
    const keywordField =
      rawKeywords === ''
        ? {}
        : { keywords: rawKeywords === '-' ? [] : rawKeywords.split(',').map((k) => k.trim()).filter(Boolean) }

    const list = [...articles.value]
    let targetArticle = null

    if (isEdit.value) {
      const idx = list.findIndex((a) => a.id === form.value.id)
      if (idx === -1) throw new Error('ไม่พบบทความที่ต้องการแก้ไข')
      const base = { ...list[idx] }
      if (rawKeywords === '') delete base.keywords
      targetArticle = {
        ...base,
        ...keywordField,
        slug: base.slug || uniqueSlug(form.value.title, list, form.value.id),
        category: form.value.category,
        categoryName: categoryLabel(form.value.category),
        title: form.value.title.trim(),
        summary: form.value.summary.trim(),
        content: form.value.content,
        image,
        tags,
        updatedAt: today,
        updated: `แก้ไข ${today}`,
      }
    } else {
      const id = Date.now()
      targetArticle = {
        id,
        slug: uniqueSlug(form.value.title, list),
        category: form.value.category,
        categoryName: categoryLabel(form.value.category),
        title: form.value.title.trim(),
        summary: form.value.summary.trim(),
        content: form.value.content,
        image,
        tags,
        ...keywordField,
        createdAt: today,
        updatedAt: today,
        updated: 'เพิ่งสร้าง',
      }
    }

    status.value = 'กำลังบันทึกบทความ...'
    await saveArticle(targetArticle)
    emit('saved')
    emit('close')
  } catch (err) {
    error.value = err.message || 'บันทึกไม่สำเร็จ'
  } finally {
    saving.value = false
    status.value = ''
  }
}
</script>

<template>
  <BaseModal :open="open" :dismissible="!saving" max-width="max-w-2xl" labelled-by="form-title" @close="emit('close')">
    <form class="max-h-[88vh] overflow-y-auto p-6" @submit.prevent="submit">
      <h3 id="form-title" class="mb-5 pr-10 text-lg font-bold text-accent">
        {{ isEdit ? 'แก้ไขบทความ' : 'เพิ่มบทความใหม่' }}
      </h3>

      <fieldset :disabled="saving" class="space-y-4">
        <div>
          <label class="form-label" for="f-title">หัวข้อบทความ</label>
          <input id="f-title" v-model="form.title" class="form-control" required placeholder="ใส่ชื่อบทความ..." />
        </div>

        <div>
          <label class="form-label" for="f-cat">หมวดหมู่</label>
          <select id="f-cat" v-model="form.category" class="form-control">
            <option v-for="c in CATEGORIES" :key="c.key" :value="c.key">{{ c.label }}</option>
          </select>
        </div>

        <div>
          <label class="form-label" for="f-img">
            รูปภาพปก / ลิงก์ YouTube (หมวดเนื้อเพลงใส่ลิงก์ YouTube ได้)
          </label>
          <div class="flex flex-col gap-2 sm:flex-row">
            <input
              id="f-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              class="form-control file:mr-3 file:rounded file:border-0 file:bg-accent/20 file:px-2 file:py-1 file:text-xs file:text-accent"
              @change="onFileChange"
            />
            <input
              id="f-img"
              v-model="form.image"
              type="text"
              class="form-control"
              placeholder="หรือวาง /image/cover/... หรือลิงก์ YouTube"
            />
          </div>
          <div v-if="filePreview" class="mt-2 flex items-center gap-3 rounded-lg bg-black/25 p-2">
            <img :src="filePreview" alt="" class="h-12 w-12 rounded-md object-cover" />
            <span class="text-xs text-muted">{{ file?.name }}</span>
          </div>
        </div>

        <div>
          <label class="form-label" for="f-tags">คำเฉพาะ / คีย์เวิร์ด (คั่นด้วย ,)</label>
          <input
            id="f-tags"
            v-model="form.tags"
            class="form-control"
            placeholder="เช่น Sol3, Lament, Rover, Sentinel"
          />
        </div>

        <div>
          <label class="form-label" for="f-kw">คำที่ให้ลิงก์อัตโนมัติในบทความอื่น</label>
          <input
            id="f-kw"
            v-model="form.keywords"
            class="form-control"
            placeholder="เว้นว่าง = เดาจากชื่อบทความให้เอง"
          />
          <p class="mt-1 text-[0.7rem] leading-relaxed text-muted">
            เว้นว่างไว้ได้เลย ระบบจะดึงคำภาษาอังกฤษจากต้นชื่อบทความมาใช้
            ใส่เองได้ถ้าอยากกำหนดหลายคำ (คั่นด้วย ,) หรือใส่ <span class="text-accent">-</span>
            ถ้าไม่อยากให้บทความนี้ถูกลิงก์
          </p>
        </div>

        <div>
          <label class="form-label" for="f-summary">เรื่องย่อ (แสดงบนการ์ด — ใช้เป็นคำอธิบายใน popup ด้วย)</label>
          <textarea id="f-summary" v-model="form.summary" class="form-control min-h-20" required
            placeholder="สั้นๆ 2-3 บรรทัด..." />
        </div>

        <div>
          <label class="form-label" for="f-content">เนื้อหาฉบับเต็ม</label>
          <textarea
            id="f-content"
            v-model="form.content"
            class="form-control min-h-48 leading-relaxed"
            required
            placeholder="รายละเอียดบทความทั้งหมด... (เว้นบรรทัดว่างเพื่อขึ้นย่อหน้าใหม่)"
            @keydown.tab="onContentTab"
          />
        </div>
      </fieldset>

      <p v-if="error" class="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
        {{ error }}
      </p>
      <p v-else-if="status" class="mt-4 text-sm text-accent">{{ status }}</p>

      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="btn-ghost" :disabled="saving" @click="emit('close')">ยกเลิก</button>
        <button type="submit" class="btn-primary" :disabled="saving">
          {{ saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล' }}
        </button>
      </div>
    </form>
  </BaseModal>
</template>
