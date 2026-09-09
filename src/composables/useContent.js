import { useAuth } from './useAuth'
import { useArticles } from './useArticles'
import { supabase } from '../lib/supabase'
import { createArchiveStore } from '../services/archiveStore'

const store = createArchiveStore(supabase)
let saving = false

export function useContent() {
  const { isAdmin } = useAuth()
  const { articles, revision, loading, loadError } = useArticles()

  function requireAdmin() {
    if (!isAdmin.value) throw new Error('กรุณาเข้าสู่ระบบผู้ดูแลก่อนบันทึก')
  }

  async function uploadImage(file) {
    requireAdmin()
    return store.uploadImage(file)
  }

  async function saveArticles(list) {
    requireAdmin()
    if (saving) throw new Error('กำลังบันทึกข้อมูล กรุณารอสักครู่')
    if (loading.value || loadError.value) throw new Error('กรุณาโหลดบทความให้สำเร็จก่อนบันทึก')
    const snapshot = JSON.parse(JSON.stringify(list))
    saving = true
    try {
      const nextRevision = await store.save(snapshot, revision.value)
      articles.value = snapshot
      revision.value = nextRevision
    } finally {
      saving = false
    }
  }

  return { uploadImage, saveArticles }
}
