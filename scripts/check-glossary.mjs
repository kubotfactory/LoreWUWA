/**
 * ตรวจว่าอภิธานศัพท์ทุกคำมีที่มาจากบทความจริง
 * รันด้วย: npm run check:glossary
 *
 * เช็ค 4 อย่าง (เฉพาะคำที่ย่อมาจากบทความ)
 *   1. ทุกคำ (รวม alias) ต้องปรากฏอยู่ในเนื้อหาบทความอย่างน้อยหนึ่งที่
 *   2. slug ที่อ้างในช่อง article ต้องมีอยู่จริง
 *   3. คำนั้นต้องปรากฏในบทความที่อ้างถึงด้วย
 *   4. รายงานคำในบทความที่ยังไม่มีในอภิธานศัพท์ (ไว้พิจารณาเพิ่ม)
 *
 * คำจาก Archive ในเกม (source: "game" — นำเข้าด้วย npm run import:terms) ใช้กติกาคนละชุด
 * เพราะคำอธิบายมาจากในเกม ไม่ได้ย่อมาจากบทความ จึงไม่บังคับว่าต้องปรากฏในบทความ
 * แต่ห้ามอ้าง article และจะถูกไฮไลต์ก็ต่อเมื่อคำนั้นโผล่ในบทความจริง
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { deriveKeywords } from '../src/utils/keywords.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'))

const articles = read('public/articles.json')
const allEntries = read('public/glossary.json')

// แยกคำที่ย่อมาจากบทความ ออกจากคำที่นำเข้ามาจาก Archive ในเกม
const glossary = allEntries.filter((g) => g.source !== 'game')
const gameTerms = allEntries.filter((g) => g.source === 'game')

const slugs = new Set(articles.map((a) => a.slug))
const textOf = (a) => `${a.title}\n${a.summary}\n${a.content}`
const bySlug = Object.fromEntries(articles.map((a) => [a.slug, textOf(a)]))
const corpus = articles.map(textOf).join('\n')

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const has = (text, word) => new RegExp(esc(word), 'i').test(text)

const problems = []
const warnings = []

for (const g of glossary) {
  const words = [g.term, ...(g.aliases || [])]
  const where = articles.filter((a) => words.some((w) => has(textOf(a), w))).map((a) => a.slug)

  if (!words.some((w) => has(corpus, w))) {
    problems.push(`"${g.term}" ไม่ปรากฏในบทความใดเลย`)
    continue
  }
  if (!g.short || g.short.trim().length < 10) {
    problems.push(`"${g.term}" ไม่มีคำอธิบาย`)
  }
  if (g.article) {
    if (!slugs.has(g.article)) {
      problems.push(`"${g.term}" อ้าง article "${g.article}" ที่ไม่มีอยู่จริง`)
    } else if (!words.some((w) => has(bySlug[g.article], w))) {
      warnings.push(`"${g.term}" ลิงก์ไป "${g.article}" แต่ไม่พบคำนี้ในบทความนั้น (พบใน: ${where.join(', ') || 'ไม่พบ'})`)
    }
  }
  if (g.ownArticle && !g.article) {
    problems.push(`"${g.term}" ตั้ง ownArticle: true แต่ไม่ได้ระบุ article`)
  }
}

const linked = glossary.filter((g) => g.ownArticle && g.article)
const popupOnly = glossary.filter(
  (g) => !g.ownArticle && [g.term, ...(g.aliases || [])].some((w) => has(corpus, w)),
)
const refOnly = glossary.filter(
  (g) => !g.ownArticle && ![g.term, ...(g.aliases || [])].some((w) => has(corpus, w)),
)

// คำที่ปรากฏซ้ำๆ ในบทความแต่ยังไม่มีในอภิธานศัพท์
const known = new Set(glossary.flatMap((g) => [g.term, ...(g.aliases || [])]).map((w) => w.toLowerCase()))
const freq = new Map()
for (const m of corpus.matchAll(/\b[A-Z][A-Za-z]{3,}(?:[ -][A-Z][A-Za-z0-9-]+)?\b/g)) {
  const w = m[0]
  if (known.has(w.toLowerCase())) continue
  freq.set(w, (freq.get(w) || 0) + 1)
}
const missing = [...freq.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 15)

const auto = articles.flatMap((a) => deriveKeywords(a).map((w) => ({ word: w, slug: a.slug, title: a.title })))
const manualTerms = new Set(linked.map((g) => g.term.toLowerCase()))
const autoOnly = auto.filter((a) => !manualTerms.has(a.word.toLowerCase()))
const noKeyword = articles.filter((a) => a.category !== 'lyrics' && deriveKeywords(a).length === 0)

// คำจากในเกม: ห้ามอ้างบทความ ต้องมีคำอธิบาย ห้ามซ้ำกันเอง
// ถ้าชนกับคำที่เขียนเองต้องผูกด้วย sameAs (มาจาก data/term-links.json) ไม่ใช่ปล่อยซ้ำลอยๆ
const ownByTerm = new Map(glossary.map((g) => [g.term.toLowerCase(), g]))
const seenGame = new Set()

for (const g of gameTerms) {
  const key = g.term.toLowerCase()
  if (seenGame.has(key)) problems.push(`"${g.term}" (ในเกม) มีซ้ำกันในไฟล์`)
  seenGame.add(key)

  if (!g.text || g.text.trim().length < 10) {
    problems.push(`"${g.term}" (ในเกม) ไม่มีคำอธิบายในช่อง text`)
  }
  if (g.article || g.ownArticle) {
    problems.push(`"${g.term}" (ในเกม) ห้ามอ้าง article — ให้ผูกกับคำที่เขียนเองผ่าน sameAs แทน`)
  }
  if (g.sameAs && !ownByTerm.has(g.sameAs.toLowerCase())) {
    problems.push(`"${g.term}" (ในเกม) ผูก sameAs ไปที่ "${g.sameAs}" ที่ไม่มีในอภิธานศัพท์`)
  }
  if (!g.sameAs && ownByTerm.has(key)) {
    problems.push(`"${g.term}" (ในเกม) ซ้ำกับคำที่เขียนเองแต่ไม่ได้ผูก sameAs — เพิ่มคู่ใน data/term-links.json`)
  }
}

// คำในเกมที่ผูกกับคำที่เขียนเองแล้ว — ยุบเป็น popup เดียว ใช้คำอธิบายฝั่งเกม
const pairs = gameTerms.filter((g) => g.sameAs)
const pairedOwn = new Set(pairs.map((g) => g.sameAs.toLowerCase()))

// คำจากในเกมที่ถูกไฮไลต์จริง — ต้องโผล่ในบทความ (ตรงกับ useGlossary.js)
// คู่ที่ผูกแล้วนับจากฝั่งคำที่เขียนเอง เพราะไฮไลต์ด้วยชื่ออังกฤษ + ชื่อไทยพร้อมกัน
const gameHighlighted = gameTerms.filter(
  (g) =>
    !g.sameAs &&
    g.highlight !== false &&
    [g.term, ...(g.aliases || [])].some((w) => has(corpus, w)),
)
const pairHighlighted = pairs.filter((g) => {
  const own = ownByTerm.get(g.sameAs.toLowerCase())
  return own?.ownArticle || [own.term, ...(own.aliases || []), g.term].some((w) => has(corpus, w))
})

console.log(`ตรวจอภิธานศัพท์ ${allEntries.length} คำ (เขียนเอง ${glossary.length} / ในเกม ${gameTerms.length}) กับบทความ ${articles.length} เรื่อง\n`)

console.log(`คีย์เวิร์ดอัตโนมัติจากบทความ: ${auto.length} คำ`)
autoOnly.forEach((a) => console.log(`   + ${a.word}  (จาก "${a.title}")`))
if (autoOnly.length !== auto.length) {
  console.log(`   (อีก ${auto.length - autoOnly.length} คำถูกเขียนทับด้วยคำอธิบายใน glossary.json)`)
}
if (noKeyword.length) {
  console.log(`\n⚠️  บทความที่ระบบเดาคีย์เวิร์ดไม่ได้ (ชื่อขึ้นต้นด้วยภาษาไทย)`)
  noKeyword.forEach((a) => console.log(`   - ${a.title}  ->  ใส่ "keywords": ["..."] ในบทความ ถ้าอยากให้ลิงก์`))
}

console.log(`\nอภิธานศัพท์ที่เขียนเอง: ${glossary.length} คำ`)
console.log(`  • ไฮไลต์พร้อมปุ่มอ่านบทความเต็ม (ownArticle): ${linked.length} คำ — ${linked.map((g) => g.term).join(', ')}`)
console.log(`  • ไฮไลต์แสดงคำอธิบายใน Popup: ${popupOnly.length} คำ`)
if (refOnly.length) {
  console.log(`  • เก็บเป็นข้อมูลอ้างอิง ยังไม่พบในบทความ: ${refOnly.length} คำ`)
}

console.log(`\nคำศัพท์จาก Archive ในเกม: ${gameTerms.length} คำ`)
console.log(
  `  • ผูกกับคำที่เขียนเอง (popup ใช้คำอธิบายจากในเกม): ${pairs.length} คู่ — ไฮไลต์อยู่ ${pairHighlighted.length} คู่`,
)
console.log(
  `  • คำที่ยังไม่มีคู่ แต่โผล่ในบทความแล้ว: ${gameHighlighted.length} คำ — ${gameHighlighted.map((g) => g.term).join(', ') || 'ยังไม่มี'}`,
)
console.log(
  `  • เก็บเป็นข้อมูลอ้างอิง รอบทความมาอ้างถึง: ${gameTerms.length - pairs.length - gameHighlighted.length} คำ\n`,
)

if (problems.length) {
  console.log('❌ ปัญหาที่ต้องแก้')
  problems.forEach((p) => console.log('   -', p))
  console.log()
}
if (warnings.length) {
  console.log('⚠️  ควรตรวจ')
  warnings.forEach((w) => console.log('   -', w))
  console.log()
}
if (!problems.length && !warnings.length) {
  console.log('✅ ทุกคำมีที่มาจากบทความ และลิงก์ถูกต้องทั้งหมด\n')
}
if (missing.length) {
  console.log('💡 คำที่โผล่บ่อยในบทความแต่ยังไม่มีในอภิธานศัพท์ (จะเพิ่มหรือไม่ก็ได้)')
  missing.forEach(([w, n]) => console.log(`   - ${w} (${n} ครั้ง)`))
  console.log()
}

process.exit(problems.length ? 1 : 0)
