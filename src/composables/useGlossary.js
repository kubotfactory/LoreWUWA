import { ref, computed } from 'vue'
import { useArticles } from './useArticles'
import { deriveKeywords, withPlural } from '../utils/keywords'

const entries = ref([])
const loaded = ref(false)
let loadPromise = null

export async function loadGlossary() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    try {
      const res = await fetch(`/glossary.json?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      entries.value = Array.isArray(data) ? data : []
    } catch (err) {
      console.warn('โหลด glossary.json ไม่สำเร็จ — ปิดการทำงานของ popup คำเฉพาะ', err)
      entries.value = []
    } finally {
      loaded.value = true
    }
  })()
  return loadPromise
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function useGlossary() {
  const { articles } = useArticles()

  /**
   * คีย์เวิร์ดอัตโนมัติจากบทความทุกเรื่อง — เขียนบทความใหม่แล้วลิงก์เองทันที
   * ไม่ต้องไปแก้ glossary.json
   */
  const autoEntries = computed(() =>
    articles.value.flatMap((article) => {
      const slug = article.slug || String(article.id)
      return deriveKeywords(article).map((word) => ({
        term: word,
        aliases: withPlural(word).slice(1),
        short: article.summary,
        article: slug,
        ownArticle: true,
        auto: true,
      }))
    }),
  )

  /** ข้อความรวมของบทความทุกเรื่อง ใช้เช็คว่าคำจากในเกมถูกพูดถึงในคลังหรือยัง */
  const corpus = computed(() =>
    articles.value
      .map((a) => `${a.title}\n${a.summary}\n${a.content}`)
      .join('\n')
      .toLowerCase(),
  )

  /** คำในเกมที่ผูกไว้กับคำที่เขียนเอง (sameAs) — ใช้ตอนยุบสองฝั่งเข้าด้วยกัน */
  const gameBySameAs = computed(() => {
    const map = new Map()
    for (const e of entries.value) {
      if (e.source === 'game' && e.sameAs) map.set(e.sameAs.toLowerCase(), e)
    }
    return map
  })

  const inCorpus = (words) =>
    words.some((w) => w && corpus.value.includes(w.toLowerCase()))

  /**
   * คำศัพท์จากในเกมที่ยังไม่มีคู่ฝั่งที่เขียนเอง — ไฮไลต์เฉพาะคำที่โผล่ในบทความจริง
   * ที่เหลือยังอยู่ในไฟล์เป็นข้อมูลอ้างอิง แต่ไม่ไปรบกวนเนื้อหา
   * คำอธิบายใช้ข้อความเต็มจากช่อง text — popup เลื่อนอ่านได้ถ้ายาวเกินจอ
   */
  const gameEntries = computed(() =>
    entries.value
      .filter((e) => {
        if (e.source !== 'game' || e.sameAs || e.highlight === false) return false
        return inCorpus([e.term, ...(e.aliases || [])])
      })
      .map((e) => ({ ...e, short: e.text })),
  )

  /**
   * รวมคีย์เวิร์ดอัตโนมัติกับที่เขียนเองใน glossary.json
   * ถ้าคำซ้ำกัน ให้ของที่เขียนเองชนะ (คำอธิบายดีกว่า) แต่รวม alias จากทั้งสองฝั่ง
   * ไฮไลต์เฉพาะคำที่มีบทความของตัวเอง — คำอื่นใน glossary.json เก็บไว้เป็นข้อมูลอ้างอิง
   * ลำดับความสำคัญ: คำจากในเกม < คีย์เวิร์ดอัตโนมัติ < คำที่เขียนเอง
   */
  const linkable = computed(() => {
    const merged = new Map()

    for (const e of gameEntries.value) {
      merged.set(e.term.toLowerCase(), { ...e, auto: false })
    }

    for (const e of autoEntries.value) {
      merged.set(e.term.toLowerCase(), { ...e })
    }

    for (const e of entries.value) {
      if (e.source === 'game') continue
      const key = e.term.toLowerCase()
      const game = gameBySameAs.value.get(key)

      // ไม่มีคู่ในเกม -> ไฮไลต์ถ้ามีคำอธิบายและโผล่ในบทความจริง
      if (!game) {
        const aliases = e.aliases || []
        if (!e.ownArticle && !inCorpus([e.term, ...aliases])) continue
        const prev = merged.get(key)
        merged.set(key, {
          ...e,
          aliases: [...new Set([...(prev?.aliases || []), ...aliases])],
          auto: false,
        })
        continue
      }

      // มีคู่ในเกม -> ยุบเป็นคำเดียว ใช้คำอธิบายทางการจากในเกมเป็นหลัก
      // hover ได้ทั้งคำอังกฤษและคำไทย ส่วนปุ่ม "อ่านบทความเต็ม" คงไว้เฉพาะคำที่มีบทความของตัวเอง
      const aliases = [
        ...new Set([...(e.aliases || []), game.term, ...(game.aliases || [])]),
      ].filter((w) => w.toLowerCase() !== key)

      if (!e.ownArticle && !inCorpus([e.term, ...aliases])) continue

      merged.set(key, {
        ...e,
        aliases,
        short: game.text,
        article: e.ownArticle ? e.article : null,
        source: 'game',
        gameId: game.gameId,
        auto: false,
      })
    }

    return [...merged.values()]
  })

  /** map จากคำ (ตัวพิมพ์เล็ก) -> entry รวมทั้ง alias */
  const lookup = computed(() => {
    const map = new Map()
    for (const entry of linkable.value) {
      for (const word of [entry.term, ...(entry.aliases || [])]) {
        if (word) map.set(word.toLowerCase(), entry)
      }
    }
    return map
  })

  /**
   * regex รวมทุกคำ เรียงจากยาวไปสั้น เพื่อให้ "The Lament" ชนะ "Lament"
   * คำที่เป็น ASCII ล้วนใส่ขอบเขตคำกันไปแมตช์กลางคำ (เช่น Echo ใน Echoes)
   * ส่วนภาษาไทย/จีน/ญี่ปุ่นไม่มีขอบเขตคำ จึงแมตช์ตรงๆ
   */
  const matcher = computed(() => {
    const words = [...lookup.value.keys()].sort((a, b) => b.length - a.length)
    if (!words.length) return null
    const parts = words.map((w) =>
      /^[\x20-\x7e]+$/.test(w) ? `(?<![A-Za-z0-9])${escapeRe(w)}(?![A-Za-z0-9-])` : escapeRe(w),
    )
    return new RegExp(`(${parts.join('|')})`, 'gi')
  })

  /**
   * แตกข้อความหนึ่งบรรทัดเป็นชิ้นๆ: { text } สำหรับข้อความธรรมดา
   * และ { text, entry } สำหรับคำเฉพาะที่ต้องทำ popup
   * แต่ละคำจะถูกไฮไลต์แค่ครั้งแรกของย่อหน้า (ส่ง used เข้ามาร่วมกัน) เพื่อไม่ให้รก
   */
  function tokenize(line, used = new Map(), skipTerm = null) {
    const re = matcher.value
    if (!re || !line) return [{ text: line }]

    const out = []
    let last = 0
    re.lastIndex = 0
    let m

    while ((m = re.exec(line)) !== null) {
      const word = m[0]
      const entry = lookup.value.get(word.toLowerCase())
      const key = entry?.term

      if (!entry || key === skipTerm) continue

      const prev = used instanceof Map ? used.get(key) : (used.has(key) ? 1 : 0)
      const isCanonical = word.toLowerCase() === key.toLowerCase()
      if (prev && (!isCanonical || (typeof prev === 'number' && prev >= word.length))) {
        continue
      }

      if (used instanceof Map) {
        used.set(key, word.length)
      } else {
        used.add(key)
      }

      if (m.index > last) out.push({ text: line.slice(last, m.index) })
      out.push({ text: word, entry })
      last = m.index + word.length
    }

    if (last < line.length) out.push({ text: line.slice(last) })
    return out.length ? out : [{ text: line }]
  }

  return { entries, autoEntries, gameEntries, linkable, loaded, lookup, matcher, tokenize, loadGlossary }
}
