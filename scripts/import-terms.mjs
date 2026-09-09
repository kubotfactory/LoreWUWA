/**
 * นำคำศัพท์จากในเกม (ไฟล์ CSV ที่ดึงมาจาก Archive ในเกม) เข้าอภิธานศัพท์
 * รันด้วย: npm run import:terms [path/to/file.csv]
 *
 * หลักการ
 *   - คำจากในเกมถูกทำเครื่องหมาย "source": "game" เพื่อแยกจากคำที่ย่อมาจากบทความ
 *   - รันซ้ำได้เรื่อยๆ ทุกครั้งจะลบคำ source: "game" ของเดิมทิ้งแล้วใส่ชุดใหม่จาก CSV
 *     ส่วนคำที่เขียนเอง (ย่อมาจาก articles.json) ไม่ถูกแตะต้อง
 *   - คำไทยในเกมที่หมายถึงสิ่งเดียวกับคำอังกฤษที่เขียนเอง (เอคโค่ = Echo) ผูกกันผ่าน
 *     data/term-links.json แล้วเขียนช่อง sameAs ไว้ให้ useGlossary.js ยุบเป็น popup เดียว
 *   - CSV ที่มีชื่อคำซ้ำกัน (คนละ id) จะถูกยุบเป็นคำเดียว เก็บคำอธิบายไว้ทั้งสองอัน
 *   - เก็บคำอธิบายเต็มๆ ในช่อง text อันเดียว popup เอาไปแสดงทั้งก้อน
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const csvPath = resolve(root, process.argv[2] || 'data/wuwa_terms_th.csv')
const glossaryPath = join(root, 'public/glossary.json')
const linksPath = join(root, 'data/term-links.json')

/**
 * ภาษาไทยไม่มีช่องว่างระหว่างคำ คำสั้นๆ จึงไปแมตช์กลางคำอื่นได้
 * เช่น "ทีม" ไปโดน "เดิมทีมี" — คำที่สั้นกว่านี้เก็บไว้เป็นข้อมูลอ้างอิงอย่างเดียว
 */
const MIN_THAI_HIGHLIGHT = 4

/** อ่าน CSV ที่มี quote และ newline ในเซลล์ได้ */
function parseCsv(text) {
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]

    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += ch
      continue
    }

    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim()))
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()

const raw = readFileSync(csvPath, 'utf8').replace(/^﻿/, '')
const [header, ...lines] = parseCsv(raw)
const col = Object.fromEntries(header.map((h, i) => [clean(h), i]))

for (const need of ['id', 'title', 'description']) {
  if (col[need] === undefined) {
    console.error(`❌ CSV ไม่มีคอลัมน์ "${need}" — พบ: ${header.join(', ')}`)
    process.exit(1)
  }
}

// ยุบคำที่ชื่อซ้ำกันให้เหลือคำเดียว เก็บคำอธิบายไว้ทุกอัน
const byTerm = new Map()
for (const line of lines) {
  const term = clean(line[col.title])
  const desc = clean(line[col.description])
  const id = Number(clean(line[col.id])) || null
  if (!term || !desc) continue

  const prev = byTerm.get(term)
  if (prev) {
    if (!prev.texts.includes(desc)) prev.texts.push(desc)
    if (id) prev.ids.push(id)
  } else {
    byTerm.set(term, { term, texts: [desc], ids: id ? [id] : [] })
  }
}

const glossary = JSON.parse(readFileSync(glossaryPath, 'utf8'))
const manual = glossary.filter((g) => g.source !== 'game')
const previousGame = glossary.filter((g) => g.source === 'game').length

// ตารางผูกคำไทยในเกมเข้ากับคำที่เขียนเอง — พลิกให้ค้นจากชื่อคำในเกมได้
const links = JSON.parse(readFileSync(linksPath, 'utf8'))
const linkOf = new Map()
for (const [ownTerm, gameTerms] of Object.entries(links)) {
  if (ownTerm.startsWith('_')) continue
  for (const gt of [gameTerms].flat()) linkOf.set(gt.toLowerCase(), ownTerm)
}

// คำที่เขียนเองมีอยู่แล้ว (รวม alias) — ถ้าไม่ได้ผูกไว้ ของในเกมไม่ต้องมาทับ
const taken = new Set(
  manual.flatMap((g) => [g.term, ...(g.aliases || [])]).map((w) => w.toLowerCase()),
)
const ownTerms = new Set(manual.map((g) => g.term))

const skipped = []
const tooShort = []
const linked = []
const added = []

for (const { term, texts, ids } of byTerm.values()) {
  const sameAs = linkOf.get(term.toLowerCase())

  if (sameAs && !ownTerms.has(sameAs)) {
    console.error(`❌ term-links.json ผูก "${term}" ไปที่ "${sameAs}" ที่ไม่มีใน glossary.json`)
    process.exit(1)
  }
  if (!sameAs && taken.has(term.toLowerCase())) {
    skipped.push(term)
    continue
  }

  // เก็บข้อความเต็มอันเดียว popup แสดงทั้งหมด (ยาวเกินจอก็เลื่อนอ่านในกล่องได้)
  // คำที่ในเกมมีคำอธิบายหลายอัน (คนละ id) เก็บไว้ทั้งหมด เรียงจากอันที่ยาวที่สุด
  const text = [...texts].sort((a, b) => b.length - a.length).join('\n\n')

  const entry = { term, text, source: 'game' }
  if (sameAs) {
    entry.sameAs = sameAs
    linked.push(`${sameAs} = ${term}`)
  }
  if (ids.length) entry.gameId = ids.sort((a, b) => a - b)
  if (!sameAs && !/^[\x20-\x7e]+$/.test(term) && term.length < MIN_THAI_HIGHLIGHT) {
    entry.highlight = false
    tooShort.push(term)
  }

  added.push(entry)
}

const merged = [...manual, ...added]
writeFileSync(glossaryPath, `${JSON.stringify(merged, null, 2)}\n`, 'utf8')

console.log(`อ่าน CSV: ${lines.length} แถว -> ${byTerm.size} คำ (ยุบคำซ้ำแล้ว)`)
console.log(`คำที่เขียนเองในอภิธานศัพท์: ${manual.length} คำ (ไม่ถูกแตะต้อง)`)
if (previousGame) console.log(`คำจากในเกมของเดิม: ${previousGame} คำ — เขียนทับด้วยชุดใหม่`)
if (linked.length) {
  console.log(`ผูกกับคำที่เขียนเอง ${linked.length} คู่ (ยุบเป็น popup เดียว): ${linked.join(', ')}`)
}
if (skipped.length) {
  console.log(`ข้าม ${skipped.length} คำที่ชนกับคำที่เขียนเองแต่ยังไม่ได้ผูกใน term-links.json: ${skipped.join(', ')}`)
}
if (tooShort.length) {
  console.log(`ปิดไฮไลต์ ${tooShort.length} คำที่สั้นเกินกว่าจะแมตช์ในภาษาไทยได้แม่นยำ: ${tooShort.join(', ')}`)
}
console.log(`\n✅ เขียน public/glossary.json แล้ว รวม ${merged.length} คำ (ในเกม ${added.length} คำ)`)
