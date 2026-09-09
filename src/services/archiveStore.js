export const COVER_BUCKET = 'article-covers'
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

export function rowToArticle(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    slug: row.slug,
    category: row.category,
    categoryName: row.category_name || row.categoryName || '',
    title: row.title,
    summary: row.summary || '',
    content: row.content || '',
    image: row.image || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    ...(row.keywords !== undefined && row.keywords !== null ? { keywords: row.keywords } : {}),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    updated: row.updated || (row.updated_at ? `แก้ไข ${row.updated_at}` : ''),
  }
}

export function articleToRow(article) {
  if (!article) return null
  return {
    id: Number(article.id),
    slug: article.slug,
    category: article.category,
    category_name: article.categoryName || article.category_name || '',
    title: article.title,
    summary: article.summary || '',
    content: article.content || '',
    image: article.image || '',
    tags: Array.isArray(article.tags) ? article.tags : [],
    keywords: Array.isArray(article.keywords) ? article.keywords : null,
    created_at: article.createdAt || article.created_at || null,
    updated_at: article.updatedAt || article.updated_at || null,
    updated: article.updated || null,
  }
}

export function createArchiveStore(client) {
  function requireClient() {
    if (!client) throw new Error('ยังไม่ได้เชื่อมต่อระบบจัดเก็บข้อมูล กรุณาติดต่อผู้ดูแลเว็บไซต์')
    return client
  }

  async function load() {
    const c = requireClient()

    // 1. ลองดึงจากตาราง articles แบบแถวเดี่ยว (1 row = 1 article) ก่อน
    try {
      const { data, error } = await c
        .from('articles')
        .select('*')
        .order('id', { ascending: false })

      if (!error && Array.isArray(data) && data.length > 0) {
        return {
          articles: data.map(rowToArticle),
          revision: 1,
          source: 'articles_table',
        }
      }
    } catch {
      // หากตาราง articles ยังไม่พร้อมหรือไม่มี ให้ fallback ไปที่ archive table เดิม
    }

    // 2. Fallback: ตาราง archive แบบก้อน JSONB เดิม (id=1)
    const { data, error } = await c.from('archive').select('articles, revision').eq('id', 1).single()
    if (error) throw new Error(error.message)
    if (!Array.isArray(data?.articles) || !Number.isSafeInteger(data.revision)) {
      throw new Error('ข้อมูลบทความไม่ถูกต้อง หรือยังไม่ได้นำเข้าบทความ')
    }
    return {
      articles: data.articles,
      revision: data.revision,
      source: 'archive_table',
    }
  }

  async function saveArticle(article) {
    const c = requireClient()
    const row = articleToRow(article)
    const { data, error } = await c.from('articles').upsert(row).select()
    if (error) throw new Error(error.message)
    return rowToArticle(data?.[0] || row)
  }

  async function deleteArticle(id) {
    const c = requireClient()
    const { error } = await c.from('articles').delete().eq('id', Number(id))
    if (error) throw new Error(error.message)
    return true
  }

  async function save(articles, revision) {
    if (!Number.isSafeInteger(revision)) throw new Error('กรุณาโหลดบทความก่อนบันทึก')
    const { data, error } = await requireClient().rpc('save_archive', {
      p_articles: articles,
      p_expected_revision: revision,
    })
    if (error?.message?.includes('ARCHIVE_CONFLICT')) {
      throw new Error('มีคนแก้ไขบทความระหว่างนี้ กรุณาคัดลอกข้อความที่แก้ไว้ แล้วรีเฟรชหน้าก่อนลองใหม่')
    }
    if (error) throw new Error(error.message)
    if (!Number.isSafeInteger(data)) throw new Error('ไม่ได้รับการยืนยันการบันทึก กรุณารีเฟรชเพื่อตรวจสอบ')
    return data
  }

  async function uploadImage(file) {
    const extension = IMAGE_TYPES[file.type]
    if (!extension) throw new Error('รองรับรูป JPG, PNG, WebP และ GIF เท่านั้น')
    if (file.size > 5 * 1024 * 1024) throw new Error('รูปใหญ่เกิน 5MB กรุณาย่อก่อนอัปโหลด')
    const bucket = requireClient().storage.from(COVER_BUCKET)
    const path = `cover_${crypto.randomUUID()}.${extension}`
    const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: false })
    if (error) throw new Error(error.message)
    return bucket.getPublicUrl(path).data.publicUrl
  }

  return { load, save, saveArticle, deleteArticle, uploadImage }
}

