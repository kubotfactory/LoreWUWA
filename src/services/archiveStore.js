export const COVER_BUCKET = 'article-covers'
const IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

export function createArchiveStore(client) {
  function requireClient() {
    if (!client) throw new Error('ยังไม่ได้เชื่อมต่อระบบจัดเก็บข้อมูล กรุณาติดต่อผู้ดูแลเว็บไซต์')
    return client
  }

  async function load() {
    const { data, error } = await requireClient().from('archive').select('articles, revision').eq('id', 1).single()
    if (error) throw new Error(error.message)
    if (!Array.isArray(data?.articles) || !Number.isSafeInteger(data.revision)) {
      throw new Error('ข้อมูลบทความไม่ถูกต้อง หรือยังไม่ได้นำเข้าบทความ')
    }
    return data
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

  return { load, save, uploadImage }
}
