/**
 * หาคีย์เวิร์ดของบทความแบบอัตโนมัติ
 *
 * ลำดับความสำคัญ
 *   1. ช่อง keywords ในตัวบทความ (ผู้เขียนกำหนดเอง) — ใส่ [] เพื่อปิดไม่ให้ลิงก์
 *   2. เดาจากชื่อบทความ: เอาส่วนที่เป็นอังกฤษ/ตัวเลขที่อยู่หน้าสุด
 *      "Suoming - 锁暝 | ผู้ผนึก..." -> "Suoming"
 *      "Rover ใช้ทุกพลังได้ยังไง?"   -> "Rover"
 *      "เจาะลึก Suisui's EP | ..."   -> ไม่มี (ขึ้นต้นด้วยภาษาไทย)
 *   3. หมวดเนื้อเพลงข้ามทั้งหมด เพราะชื่อเพลงไม่ใช่ศัพท์เฉพาะ
 */
export function deriveKeywords(article) {
  if (!article) return []

  if (Array.isArray(article.keywords)) {
    return article.keywords.map((k) => String(k).trim()).filter(Boolean)
  }

  if (article.category === 'lyrics') return []

  const head = String(article.title || '').split(/[|｜]/)[0].trim()
  const match = head.match(/^[A-Za-z0-9][A-Za-z0-9'’\-. ]*/)
  if (!match) return []

  const word = match[0].replace(/[\s\-'’.]+$/, '').trim()
  if (word.length < 3 || !/[A-Za-z]{3}/.test(word)) return []
  return [word]
}

/** เติมรูปพหูพจน์ให้คำภาษาอังกฤษ เช่น Threnodian -> Threnodians */
export function withPlural(word) {
  const out = [word]
  if (/^[\x20-\x7e]+$/.test(word) && !/s$/i.test(word)) out.push(`${word}s`)
  return out
}
