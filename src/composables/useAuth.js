import { ref } from 'vue'
import { supabase, backendConfigured } from '../lib/supabase'

const email = ref('')
const isAdmin = ref(false)
let initialization
let generation = 0

async function membership(session) {
  const { data, error } = await supabase.from('archive_admins').select('user_id')
    .eq('user_id', session.user.id).maybeSingle()
  return !error && Boolean(data)
}

async function syncSession(session, current = ++generation) {
  if (current !== generation) return false
  isAdmin.value = false
  email.value = session?.user?.email || ''
  if (!session?.user) return false
  const allowed = await membership(session)
  if (current !== generation) return false
  isAdmin.value = allowed
  return isAdmin.value
}

export function initializeAuth() {
  if (!supabase) return Promise.resolve()
  if (initialization) return initialization
  // Finish the auth callback before making another Supabase request.
  supabase.auth.onAuthStateChange((_event, session) => {
    const current = ++generation
    if (!session) {
      isAdmin.value = false
      email.value = ''
      return
    }
    setTimeout(() => {
      syncSession(session, current).catch(() => {
        if (current === generation) isAdmin.value = false
      })
    }, 0)
  })
  const current = generation
  initialization = supabase.auth.getSession()
    .then(({ data }) => syncSession(data.session, current))
    .catch(() => { isAdmin.value = false })
  return initialization
}

export function useAuth() {
  async function login(inputEmail, password) {
    if (!supabase) return { ok: false, message: 'ยังไม่ได้เชื่อมต่อระบบผู้ดูแลเว็บไซต์' }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: inputEmail.trim(), password })
      if (error) return { ok: false, message: 'เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมลและรหัสผ่าน' }
      if (!data.session || !await membership(data.session)) {
        await supabase.auth.signOut({ scope: 'local' })
        return { ok: false, message: 'บัญชีนี้ยังไม่ได้รับสิทธิ์ผู้ดูแลเว็บไซต์' }
      }
      email.value = data.session.user.email || ''
      isAdmin.value = true
      return { ok: true }
    } catch {
      return { ok: false, message: 'เชื่อมต่อระบบไม่ได้ กรุณาลองใหม่' }
    }
  }

  async function logout() {
    ++generation
    isAdmin.value = false
    email.value = ''
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) throw new Error('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่')
  }

  return { email, isAdmin, backendConfigured, login, logout }
}
