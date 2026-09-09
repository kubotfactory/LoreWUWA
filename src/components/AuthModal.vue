<script setup>
import { ref, watch } from 'vue'
import BaseModal from './BaseModal.vue'
import { useAuth } from '../composables/useAuth'

const props = defineProps({ open: { type: Boolean, default: false } })
const emit = defineEmits(['close'])
const { email, backendConfigured, login } = useAuth()
const form = ref({ email: '', password: '' })
const error = ref('')
const busy = ref(false)

watch(() => props.open, (isOpen) => {
  form.value.password = ''
  if (isOpen) {
    form.value.email = email.value
    error.value = ''
  }
})

async function submit() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await login(form.value.email, form.value.password)
    if (result.ok) emit('close')
    else error.value = result.message
  } finally {
    busy.value = false
    form.value.password = ''
  }
}
</script>

<template>
  <BaseModal :open="open" :dismissible="!busy" max-width="max-w-md" labelled-by="auth-title" @close="emit('close')">
    <form class="p-6" @submit.prevent="submit">
      <h3 id="auth-title" class="mb-5 pr-10 text-lg font-bold text-accent">🔑 เข้าสู่ระบบผู้ดูแล</h3>
      <p v-if="!backendConfigured" class="text-sm leading-relaxed text-muted">
        เว็บไซต์ยังไม่ได้เปิดระบบแก้ไขออนไลน์ กรุณาติดต่อผู้ดูแลเพื่อตั้งค่าระบบ
      </p>
      <template v-else>
        <fieldset :disabled="busy" class="space-y-4">
          <div>
            <label class="form-label" for="a-email">อีเมล</label>
            <input id="a-email" v-model="form.email" type="email" autocomplete="username" class="form-control" required />
          </div>
          <div>
            <label class="form-label" for="a-password">รหัสผ่าน</label>
            <input id="a-password" v-model="form.password" type="password" autocomplete="current-password" class="form-control" required />
          </div>
        </fieldset>
        <p class="mt-4 text-xs leading-relaxed text-muted">สำหรับบัญชีที่ได้รับสิทธิ์ผู้ดูแลเท่านั้น หากลืมรหัสผ่านให้ติดต่อเจ้าของเว็บไซต์</p>
        <p v-if="error" class="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{{ error }}</p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="btn-ghost" :disabled="busy" @click="emit('close')">ยกเลิก</button>
          <button type="submit" class="btn-primary" :disabled="busy">{{ busy ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ' }}</button>
        </div>
      </template>
    </form>
  </BaseModal>
</template>
