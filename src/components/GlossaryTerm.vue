<script setup>
import { nextTick, onUnmounted, ref } from 'vue'

const props = defineProps({
  text: { type: String, required: true },
  entry: { type: Object, required: true },
})
const trigger = ref(null)
const popup = ref(null)
const open = ref(false)
const style = ref({})
let openTimer = null
let closeTimer = null

const POPUP_W = 320 // ต้องตรงกับ w-80
const POPUP_H = 170 // ค่าประมาณไว้ใช้รอบแรก ก่อนที่ popup จะถูกวาดจริง

/**
 * คำอธิบายจาก Archive ในเกมยาวได้ถึงเกือบพันตัวอักษร ความสูงจึงไม่คงที่
 * รอบแรกวางด้วยค่าประมาณ แล้ววัดความสูงจริงหลังวาดเสร็จเพื่อวางซ้ำอีกที
 * เลือกฝั่งที่มีที่ว่างมากกว่า แล้วล็อกความสูงไว้เท่าที่ว่างจริง ส่วนที่เกินให้เลื่อนอ่านแทนการล้นจอ
 */
function place() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return

  const gap = 10
  const spaceBelow = window.innerHeight - rect.bottom - gap
  const spaceAbove = rect.top - gap
  const height = popup.value ? popup.value.scrollHeight + 2 : POPUP_H
  const below = spaceBelow >= height || spaceBelow >= spaceAbove
  const room = Math.max(140, below ? spaceBelow : spaceAbove) - gap

  const left = Math.min(
    Math.max(12, rect.left + rect.width / 2 - POPUP_W / 2),
    window.innerWidth - POPUP_W - 12,
  )

  style.value = {
    left: `${left}px`,
    maxHeight: `${room}px`,
    ...(below
      ? { top: `${rect.bottom + gap}px` }
      : { bottom: `${window.innerHeight - rect.top + gap}px` }),
  }
}

async function openNow() {
  place()
  open.value = true
  await nextTick()
  place() // วางซ้ำด้วยความสูงจริง
  window.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', hideNow)
}

/** เลื่อนอ่านข้างใน popup เองไม่ต้องปิด ปิดเฉพาะตอนหน้าเว็บข้างหลังเลื่อน */
function onScroll(e) {
  if (popup.value && e.target instanceof Node && popup.value.contains(e.target)) return
  hideNow()
}

function show() {
  clearTimeout(closeTimer)
  openTimer = setTimeout(openNow, 90)
}

function hide() {
  clearTimeout(openTimer)
  closeTimer = setTimeout(hideNow, 160)
}

function hideNow() {
  clearTimeout(openTimer)
  open.value = false
  window.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', hideNow)
}

/** เมาส์เข้ามาในตัว popup เอง — ยกเลิกการปิดค้างไว้ */
function keepOpen() {
  clearTimeout(closeTimer)
}

/**
 * คลิก "อ่านบทความเต็ม" — แค่ปิด popup พอ
 * ห้ามสั่งปิด modal เพราะ RouterLink กำลังเปลี่ยน route ไปบทความใหม่อยู่
 * ถ้าปิด modal จะไปสั่ง push กลับหน้าแรกทับการเปลี่ยนหน้าพอดี
 */
function onNavigate() {
  hideNow()
}

/** แตะบนมือถือ: กดครั้งแรกเปิด กดซ้ำปิด */
function toggle() {
  if (open.value) hideNow()
  else {
    clearTimeout(openTimer)
    openNow()
  }
}

onUnmounted(hideNow)
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="cursor-help border-b border-dotted border-accent/70 text-accent/90 transition hover:text-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-accent"
    :aria-expanded="open"
    :aria-label="`ดูคำอธิบายของ ${entry.term}`"
    @mouseenter="show"
    @mouseleave="hide"
    @focus="show"
    @blur="hide"
    @click="toggle"
    @keydown.esc="hideNow"
  >{{ text }}</button>

  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0 translate-y-1"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        ref="popup"
        class="fixed z-[60] w-80 overflow-y-auto overscroll-contain rounded-xl border border-accent/30 bg-panel p-3.5 text-left shadow-2xl shadow-black/60"
        :style="style"
        role="tooltip"
        @mouseenter="keepOpen"
        @mouseleave="hide"
      >
        <p class="mb-1.5 text-sm font-semibold text-accent">{{ entry.term }}</p>
        <p class="whitespace-pre-line text-[0.78rem] leading-relaxed text-body/85">{{ entry.short }}</p>
        <p v-if="entry.source === 'game'" class="mt-2 text-[0.68rem] text-body/50">
          คำอธิบายจาก Archive ในเกม
        </p>
        <RouterLink
          v-if="entry.ownArticle && entry.article"
          :to="`/lore/${entry.article}`"
          class="mt-2.5 inline-block text-[0.72rem] font-medium text-accent hover:underline"
          @click="onNavigate"
        >
          อ่านบทความเต็ม &rarr;
        </RouterLink>
      </div>
    </Transition>
  </Teleport>
</template>
