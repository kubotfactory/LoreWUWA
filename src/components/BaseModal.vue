<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  dismissible: { type: Boolean, default: true },
  maxWidth: { type: String, default: 'max-w-5xl' },
  labelledBy: { type: String, default: undefined },
})
const emit = defineEmits(['close'])

const panel = ref(null)
let lastFocused = null

function onKeydown(e) {
  if (!props.open) return
  if (e.key === 'Escape' && props.dismissible) {
    emit('close')
    return
  }
  // focus trap เบาๆ ให้ Tab วนอยู่ในกล่อง
  if (e.key === 'Tab' && panel.value) {
    const focusables = panel.value.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
    )
    if (!focusables.length) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }
}

watch(
  () => props.open,
  (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    if (isOpen) {
      lastFocused = document.activeElement
      requestAnimationFrame(() => panel.value?.focus())
    } else {
      lastFocused?.focus?.()
    }
  },
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Transition
    enter-active-class="transition duration-200"
    enter-from-class="opacity-0"
    leave-active-class="transition duration-150"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm sm:p-6"
      @click.self="dismissible && emit('close')"
    >
      <div
        ref="panel"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="labelledBy"
        :class="[
          maxWidth,
          'relative my-4 w-full rounded-2xl border border-line bg-card shadow-2xl outline-none',
        ]"
      >
        <button
          type="button"
          :disabled="!dismissible"
          class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-ink/80 text-xl leading-none text-muted transition hover:border-danger hover:text-danger"
          aria-label="ปิด"
          @click="emit('close')"
        >
          &times;
        </button>
        <slot />
      </div>
    </div>
  </Transition>
</template>
