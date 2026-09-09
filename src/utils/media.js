const YT_RE = /(?:youtu\.be\/|\/v\/|\/u\/\w\/|\/embed\/|watch\?v=|&v=)([\w-]{11})/

/** ดึง video id จากลิงก์ YouTube ทุกรูปแบบ — คืน null ถ้าไม่ใช่ */
export function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null
  const match = url.match(YT_RE)
  return match ? match[1] : null
}

export function youtubeThumb(id) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

export function youtubeEmbed(id) {
  return `https://www.youtube.com/embed/${id}`
}

/** ภาพสำรองเมื่อรูปต้นทางโหลดไม่ขึ้น (ลิงก์ตาย/ถูกลบ) — เป็น SVG ฝังในตัว ไม่ต้องยิงเน็ต */
export const FALLBACK_IMAGE =
  'data:image/svg+xml;charset=utf-8,' +
  // ใช้ canvas จัตุรัสและวางข้อความไว้กลางภาพ เพื่อให้ยังอ่านออกเมื่อถูก crop เป็น 16:9
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">
<rect width="320" height="320" fill="#151922"/>
<text x="160" y="152" text-anchor="middle" font-size="40" fill="#fbcc27" opacity=".55">&#9835;</text>
<text x="160" y="185" text-anchor="middle" font-size="13" fill="#8a99ad" font-family="sans-serif">image unavailable</text>
</svg>`)

/** ใส่ใน @error ของ &lt;img&gt; — สลับไปภาพสำรองครั้งเดียว ไม่วนลูป */
export function onImageError(event) {
  const img = event.target
  if (img.dataset.fallbackApplied) return
  img.dataset.fallbackApplied = '1'
  img.src = FALLBACK_IMAGE
}

/** รูปที่จะโชว์บนการ์ด — ถ้าเป็นลิงก์ YouTube ให้ใช้ thumbnail แทน */
export function cardImage(article) {
  const id = extractYouTubeId(article.image)
  return id ? youtubeThumb(id) : article.image
}

/**
 * แตกเนื้อหาเป็นย่อหน้า -> บรรทัด
 * คืนเป็น array เพื่อให้ template render ด้วย {{ }} ได้ (escape อัตโนมัติ กัน XSS)
 */
export function toParagraphs(content) {
  if (!content) return []
  return content
    .trim()
    .split(/\n\s*(?:\.\s*)?\n/)
    .map((para) => para.split('\n').filter((l) => l.trim() !== '.' && l.trim() !== ''))
    .filter((lines) => lines.length > 0)
}

/** สร้าง slug จากหัวข้อ — ตรรกะเดียวกับสคริปต์ migrate */
export function slugify(title) {
  const head = String(title || '').split(/[|｜]/)[0].trim()
  const asciiWords = head.match(/[A-Za-z0-9]+/g)
  if (asciiWords && asciiWords.join('').length >= 2) {
    return asciiWords.map((w) => w.toLowerCase()).join('-')
  }
  return head
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

/** กันชื่อซ้ำกับบทความอื่น */
export function uniqueSlug(title, articles, selfId = null) {
  const base = slugify(title) || `article-${Date.now()}`
  const taken = new Set(articles.filter((a) => a.id !== selfId).map((a) => a.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
