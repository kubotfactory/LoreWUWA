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

  async function performBulkSave(list) {
    if (loading.value || loadError.value) throw new Error('กรุณาโหลดบทความให้สำเร็จก่อนบันทึก')
    const snapshot = JSON.parse(JSON.stringify(list))
    const nextRevision = await store.save(snapshot, revision.value)
    articles.value = snapshot
    revision.value = nextRevision
    return nextRevision
  }

  async function saveArticles(list) {
    requireAdmin()
    if (saving) throw new Error('กำลังบันทึกข้อมูล กรุณารอสักครู่')
    saving = true
    try {
      return await performBulkSave(list)
    } finally {
      saving = false
    }
  }

  async function saveArticle(article) {
    requireAdmin()
    if (saving) throw new Error('กำลังบันทึกข้อมูล กรุณารอสักครู่')
    saving = true
    try {
      try {
        const saved = await store.saveArticle(article)
        const idx = articles.value.findIndex((a) => a.id === saved.id)
        if (idx !== -1) {
          articles.value[idx] = saved
        } else {
          articles.value.unshift(saved)
        }
        return saved
      } catch (tableErr) {
        // Fallback: หากยังไม่ได้ migrate ไป articles table ให้บันทึกผ่าน archive table เดิม
        const next = [...articles.value]
        const idx = next.findIndex((a) => a.id === article.id)
        if (idx !== -1) next[idx] = article
        else next.unshift(article)
        await performBulkSave(next)
        return article
      }
    } finally {
      saving = false
    }
  }

  async function deleteArticle(id) {
    requireAdmin()
    if (saving) throw new Error('กำลังบันทึกข้อมูล กรุณารอสักครู่')
    saving = true
    try {
      try {
        await store.deleteArticle(id)
        articles.value = articles.value.filter((a) => a.id !== id)
      } catch (tableErr) {
        // Fallback: หากยังไม่ได้ migrate ไป articles table ให้บันทึกผ่าน archive table เดิม
        const next = articles.value.filter((a) => a.id !== id)
        await performBulkSave(next)
      }
    } finally {
      saving = false
    }
  }

  return { uploadImage, saveArticle, deleteArticle, saveArticles }
}

