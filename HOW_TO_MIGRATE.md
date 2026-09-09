# คู่มือการย้ายระบบจัดเก็บบทความ Supabase เป็นตารางแยกบทความ (articles)

เอกสารนี้จัดทำขึ้นเพื่อให้ผู้ดูแลระบบ หรือ AI Agent นำไปใช้ดำเนินการปรับปรุงโครงสร้างฐานข้อมูลบน **Supabase** ของโปรเจกต์ Tethys's Archive จากเดิมที่เก็บรวมไว้เป็น JSONB แถวเดียว ให้เปลี่ยนเป็นตารางบทความแบบแถวเดี่ยว (**1 แถว = 1 บทความ**)

---

## 1. สาเหตุและข้อดีของการปรับปรุง

### ปัญหาของโครงสร้างเดิม (ตาราง `archive`)
- เก็บทุกบทความ (31 บทความ) รวมไว้ในแถวเดียว (`id = 1`) ในคอลัมน์ `articles` ชนิด `jsonb`
- เมื่อเปิดเข้าไปดูใน Supabase Table Editor จะมองเห็นแค่ 1 แถว ไม่สามารถดูรายการบทความ ค้นหา หรือแก้ไขทีละบทความผ่าน Dashboard ของ Supabase ได้สะดวก
- ต้องอาศัยระบบ revision check (`save_archive`) ป้องกันการบันทึกทับ

### โครงสร้างใหม่ (ตาราง `articles`)
- แยกเก็บ **1 แถว = 1 บทความ**
- สามารถดูรายการ, ค้นหา, กรอง และแก้ไขเนื้อหาแต่ละบทความได้โดยตรงใน Supabase Table Editor
- แก้ไขบทความไหน ก็บันทึกเฉพาะแถวนั้น (`upsert` / `delete`) ไม่ต้องส่งข้อมูลทั้ง 31 บทความไปเขียนใหม่ทั้งหมด
- โค้ดฝั่ง Frontend ได้รับการอัปเดตให้รองรับแบบ Hybrid: จะพยายามเชื่อมต่อตาราง `articles` ก่อน หากยังไม่ได้ Migrate จะ Fallback ไปอ่านตาราง `archive` เดิม และมี Offline Fallback ไปที่ `articles.json`

---

## 2. ขั้นตอนการทำ Migration (สำหรับผู้ใช้ หรือ Agent)

ทำได้ 2 ทางเลือกตามความสะดวก:

### ทางเลือกที่ 1 (แนะนำ): ย้ายข้อมูลอัตโนมัติจากตารางเดิม (`archive`) ไปตารางใหม่ (`articles`)
> ข้อมูล 31 บทความที่มีอยู่แล้วใน Supabase จะถูกคัดลอกและจัดโครงสร้างใหม่เข้าตาราง `articles` ทันที โดยที่ตารางเดิมไม่ถูกลบ (ปลอดภัย 100%)

1. เข้าไปที่ Dashboard ของโปรเจกต์ใน Supabase: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. เลือกโปรเจกต์ **LoreWUWA** (หรือ URL: `sgttfxksmvgqxbeikfnu`)
3. ไปที่เมนู **SQL Editor** ทางแถบซ้าย
4. คลิก **New Query** แล้ว Copy โค้ด SQL ด้านล่างนี้ไปวาง แล้วกดปุ่ม **Run**:

```sql
-- Migration: Change storage model from single jsonb row in 'archive' to 'articles' table (1 row per article)
begin;

-- 1. สร้างตาราง articles
create table if not exists public.articles (
  id bigint primary key default (extract(epoch from now()) * 1000)::bigint,
  slug text unique not null,
  category text not null,
  category_name text,
  title text not null,
  summary text not null default '',
  content text not null default '',
  image text not null default '',
  tags text[] not null default '{}',
  keywords text[] default null,
  created_at text,
  updated_at text,
  updated text,
  created_time timestamptz not null default now(),
  updated_time timestamptz not null default now()
);

-- 2. เปิดใช้งาน Row Level Security (RLS)
alter table public.articles enable row level security;

-- 3. กำหนดสิทธิ์และการเข้าถึง
grant select on public.articles to anon, authenticated;
grant insert, update, delete on public.articles to authenticated;

-- ทุกคน (รวมผู้เยี่ยมชมทั่วไป) อ่านบทความได้
drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select to anon, authenticated using (true);

-- เฉพาะ Admin (ที่อยู่ในตาราง archive_admins) จึงจะเพิ่ม/แก้ไข/ลบ บทความได้
drop policy if exists articles_admin_write on public.articles;
create policy articles_admin_write on public.articles for all to authenticated
  using (exists (select 1 from public.archive_admins where user_id = auth.uid()))
  with check (exists (select 1 from public.archive_admins where user_id = auth.uid()));

-- 4. Auto-migrate: คัดลอกบทความเดิมทั้งหมดจากตาราง archive มาใส่ในตาราง articles
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'archive') then
    insert into public.articles (id, slug, category, category_name, title, summary, content, image, tags, keywords, created_at, updated_at, updated)
    select
      (a->>'id')::bigint,
      case
        when (a->>'id') = '1786165562305' and (a->>'slug') = 'rover' then 'rover-2'
        else coalesce(nullif(a->>'slug', ''), a->>'id', 'article-' || (a->>'id'))
      end,
      coalesce(nullif(a->>'category', ''), 'main'),
      a->>'categoryName',
      coalesce(nullif(a->>'title', ''), 'Untitled'),
      coalesce(a->>'summary', ''),
      coalesce(a->>'content', ''),
      coalesce(a->>'image', ''),
      coalesce(array(select jsonb_array_elements_text(a->'tags')), '{}'),
      case
        when a ? 'keywords' and jsonb_typeof(a->'keywords') = 'array'
        then array(select jsonb_array_elements_text(a->'keywords'))
        else null
      end,
      a->>'createdAt',
      a->>'updatedAt',
      a->>'updated'
    from public.archive, jsonb_array_elements(articles) as a
    on conflict (id) do update set
      slug = excluded.slug,
      category = excluded.category,
      category_name = excluded.category_name,
      title = excluded.title,
      summary = excluded.summary,
      content = excluded.content,
      image = excluded.image,
      tags = excluded.tags,
      keywords = excluded.keywords,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      updated = excluded.updated,
      updated_time = now();
  end if;
end $$;

commit;
```

5. เมื่อรันสำเร็จ ไปที่เมนู **Table Editor** แล้วเลือกตาราง **articles** จะเห็นรายการบทความทั้งหมด 31 แถว พร้อมคอลัมน์แยกชัดเจน!

---

### ทางเลือกที่ 2: นำเข้าบทความจากไฟล์ `supabase/seed_articles.sql` โดยตรง
หากเป็นฐานข้อมูลใหม่ หรือต้องการซิงก์บทความจากไฟล์ `public/articles.json` เข้าสู่ตาราง `articles` โดยตรง:
1. เปิดไฟล์ `supabase/seed_articles.sql` ในโปรเจกต์
2. Copy คำสั่ง SQL ทั้งหมด
3. นำไปวางและกด **Run** ใน Supabase SQL Editor

---

## 3. สรุปโครงสร้างคอลัมน์ของตาราง `articles`

| คอลัมน์ | ชนิดข้อมูล | คำอธิบาย | ตัวอย่างค่า |
|---|---|---|---|
| `id` | `bigint` (Primary Key) | รหัสบทความ (Timestamp ms) | `1788345499078` |
| `slug` | `text` (Unique) | URL slug สำหรับเปิดบทความ | `'rabelle-s-curve'` |
| `category` | `text` | รหัสหมวดหมู่ | `'main'`, `'regions'`, `'characters'` |
| `category_name` | `text` | ชื่อหมวดหมู่ภาษาไทย | `'Lore พื้นฐาน'`, `'ภูมิภาค'` |
| `title` | `text` | ชื่อบทความ | `'Rabelle''s Curve'` |
| `summary` | `text` | สรุปบทความสั้นๆ สำหรับการ์ด | `'มาตรฐานที่ใช้ในการประเมิน...'` |
| `content` | `text` | เนื้อหาบทความฉบับเต็ม | Markdown / เนื้อหาข้อความ |
| `image` | `text` | URL หรือ Path รูปภาพปก | `'/image/cover/cover_xxx.jpg'` |
| `tags` | `text[]` | ป้ายกำกับ (Array ของข้อความ) | `ARRAY['Forte', 'Resonator']` |
| `keywords` | `text[]` (Null ได้) | คำสำคัญสำหรับ Autolink | `ARRAY['คำที่ต้องการไฮไลท์']` หรือ `null` |
| `created_at` | `text` | วันที่สร้าง (รูปแบบแสดงผล) | `'2/9/2569'` |
| `updated_at` | `text` | วันที่แก้ไขล่าสุด (รูปแบบแสดงผล) | `'2/9/2569'` |
| `updated` | `text` | ป้ายข้อความสถานะ | `'เพิ่งสร้าง'`, `'แก้ไข 2/9/2569'` |
| `created_time` | `timestamptz` | เวลาสร้างจริงในฐานข้อมูล | `now()` |
| `updated_time` | `timestamptz` | เวลาแก้ไขจริงในฐานข้อมูล | `now()` |

---

## 4. การจัดการ Admin
สิทธิ์ในการเพิ่ม/แก้ไข/ลบ บทความถูกควบคุมด้วยตาราง `public.archive_admins`
หากต้องการเพิ่มผู้ใช้ให้มีสิทธิ์เป็น Admin:
```sql
insert into public.archive_admins (user_id)
values ('<UUID-ของ-USER-จาก-auth.users>');
```

---

## 5. การทำงานร่วมกันกับ Frontend

โค้ดฝั่งเว็บได้รับการปรับปรุงแล้วในไฟล์:
- `src/services/archiveStore.js`: มีฟังก์ชัน `saveArticle(article)` และ `deleteArticle(id)` สำหรับทำงานกับตาราง `articles` โดยตรง และแปลงคอลัมน์ `category_name` <-> `categoryName` ให้อัตโนมัติ
- `src/composables/useContent.js`: รองรับทั้ง `saveArticle`, `deleteArticle` และมี Fallback กลับไปที่ `saveArticles` แบบเดิมหากตาราง `articles` ยังไม่พร้อม
- `src/components/ArticleForm.vue`: บันทึกผ่าน `saveArticle`
- `src/views/HomeView.vue`: ลบผ่าน `deleteArticle`
- `src/components/ArticleModal.vue`: เพิ่มปุ่ม "✏️ แก้ไขบทความนี้" ให้ Admin สามารถกดแก้ไขได้ทันทีขณะเปิดอ่านบทความ

