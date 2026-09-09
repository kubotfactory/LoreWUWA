// หมวดหมู่ทั้งหมดของคลัง — แก้ที่เดียว ใช้ทั้ง sidebar, dropdown, ฟอร์ม และ badge
export const CATEGORIES = [
  { key: 'story', label: 'เนื้อเรื่องหลัก' },
  { key: 'main', label: 'Lore พื้นฐาน' },
  { key: 'history', label: 'ประวัติศาสตร์' },
  { key: 'regions', label: 'ภูมิภาค' },
  { key: 'organizations', label: 'องค์กร/ฝ่าย' },
  { key: 'characters', label: 'ตัวละคร' },
  { key: 'lyrics', label: 'เนื้อเพลงแปลไทย' },
  { key: 'other', label: 'อื่นๆ' },
]

export const ALL_CATEGORY = { key: 'all', label: 'ทั้งหมด' }

export function categoryLabel(key) {
  if (key === 'all') return ALL_CATEGORY.label
  return CATEGORIES.find((c) => c.key === key)?.label || 'ไม่ระบุหมวดหมู่'
}

export const SORT_OPTIONS = [
  { value: 'date-new', label: 'สร้างล่าสุด' },
  { value: 'date-old', label: 'สร้างเก่าสุด' },
  { value: 'name-asc', label: 'เรียงตามชื่อ (ก - ฮ / A - Z)' },
  { value: 'name-desc', label: 'เรียงตามชื่อ (ฮ - ก / Z - A)' },
]
