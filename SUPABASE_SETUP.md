# เปิดระบบแก้ไขออนไลน์บน Vercel

เว็บไซต์ยังอยู่บน Vercel ส่วนบทความ รูปปกใหม่ และบัญชีผู้ดูแลเก็บบน Supabase บันทึกแล้วข้อมูลเปลี่ยนทันที ผู้เข้าชมที่เปิดหน้าไว้แล้วจะเห็นข้อมูลใหม่เมื่อรีเฟรช ไม่ต้อง commit หรือรอ deploy เมื่อแก้บทความ

## 1. สร้าง Supabase project

เข้า [Supabase Dashboard](https://supabase.com/dashboard) แล้วสร้าง project สำหรับเว็บไซต์นี้ เลือก region ใกล้ผู้เข้าชม ตรวจสอบราคาและโควตาของแผนที่เลือกก่อนสร้าง เก็บรหัสผ่านฐานข้อมูลไว้กับตัว ไม่ต้องใส่ในเว็บไซต์

## 2. สร้างฐานข้อมูลและพื้นที่รูปภาพ

ใน Supabase เปิด **SQL Editor → New query** แล้วคัดลอกเนื้อหาจาก [supabase/schema.sql](supabase/schema.sql) ทั้งหมดไปกด Run

สคริปต์จะสร้างตารางบทความ ตารางสิทธิ์ผู้ดูแล และ bucket `article-covers` โดยผู้อ่านทั่วไปอ่านบทความและรูปได้ แต่มีเพียงผู้ดูแลที่คุณระบุเท่านั้นที่บันทึกบทความหรืออัปโหลดรูปได้

## 3. นำเข้าบทความเดิม

ไฟล์ [supabase/seed.sql](supabase/seed.sql) เตรียมจากบทความในโปรเจกต์ไว้แล้ว เปิด query ใหม่ คัดลอกไฟล์นี้ทั้งหมดแล้วกด Run ถ้าต้องการสร้างไฟล์ใหม่หลังแก้ข้อมูลต้นฉบับ ให้รัน `npm run prepare:supabase`

การนำเข้าซ้ำจะไม่ทับบทความที่มีอยู่ในฐานข้อมูล รูปเดิมยังใช้ไฟล์ใน `public/image` ที่ Vercel เสิร์ฟอยู่ จึงไม่ต้องย้ายรูปเดิมและห้ามลบโฟลเดอร์นี้ รูปที่อัปโหลดใหม่ผ่านหน้าเว็บจะเก็บใน Supabase

## 4. สร้างบัญชีผู้ดูแล

1. เปิด **Authentication → Users → Add user → Create new user** สร้างบัญชีด้วยอีเมลและรหัสผ่านที่คุณต้องการ เปิด Auto Confirm User หากมีตัวเลือกนี้
2. ในการตั้งค่า Authentication ปิดการสมัครสมาชิกใหม่ เพราะเว็บนี้ใช้บัญชีที่เจ้าของสร้างให้เท่านั้น
3. คัดลอก **User UID** ของบัญชีที่สร้าง แล้วรันคำสั่งนี้ใน SQL Editor โดยแทนข้อความในเครื่องหมายอัญประกาศด้วย UID จริง:

```sql
insert into public.archive_admins (user_id)
values ('PASTE-USER-UID-HERE'::uuid)
on conflict do nothing;
```

การมีบัญชีอย่างเดียวไม่ทำให้แก้เว็บได้ ต้องทำขั้นตอนที่ 3 ด้วย ห้ามเพิ่ม policy ที่ให้ผู้ใช้ทั่วไปเพิ่มตัวเองใน `archive_admins`

หากต้องการถอดสิทธิ์ ให้ลบแถว UID นั้นในตาราง `archive_admins` ผ่าน Dashboard หากลืมรหัสผ่าน ให้เจ้าของ project จัดการบัญชีผ่าน Supabase Dashboard เว็บนี้ยังไม่มีหน้าลืมรหัสผ่าน

## 5. เชื่อม Vercel

ใน Supabase เปิด **Connect** หรือหน้าตั้งค่า **API Keys** แล้วคัดลอก Project URL และ **Publishable key** (เริ่มต้น `sb_publishable_...`)

ใน Vercel เปิด project นี้ → **Settings → Environment Variables** แล้วเพิ่ม:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL เช่น `https://YOUR-PROJECT.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key จาก Supabase |

เลือก environment ที่ต้องการใช้งาน เช่น Production ถ้า Preview ใช้ project เดียวกัน การแก้ผ่าน Preview จะเปลี่ยนข้อมูลจริงด้วย ควรแยก Supabase project สำหรับการทดลอง

ใช้เฉพาะ **public publishable key** ห้ามใส่ Secret key, `service_role` key หรือรหัสผ่านฐานข้อมูลในตัวแปร `VITE_` เพราะค่ากลุ่มนี้ถูกฝังในเว็บที่ทุกคนดาวน์โหลดได้ สิทธิ์การเขียนถูกบังคับด้วยฐานข้อมูล ไม่ได้ขึ้นกับการซ่อน public key

นำโค้ดชุดนี้ขึ้น Vercel แล้ว **Redeploy** หนึ่งครั้งเพื่อให้เว็บอ่านตัวแปรใหม่ ใช้ Framework: Vite, Build Command: `npm run build`, Output Directory: `dist` จากนั้นการแก้บทความและอัปโหลดรูปไม่ต้อง redeploy อีก การแก้โค้ดหรือ glossary ยังต้อง deploy ตามเดิม

## 6. ทดลองใช้งาน

เปิดเว็บ → กดดินสอมุมขวาล่าง → ใส่อีเมลและรหัสผ่าน → แก้เรื่องย่อบทความแล้วบันทึก เปิดเว็บในหน้าต่างส่วนตัวอีกหน้าหนึ่งเพื่อตรวจว่าเห็นข้อมูลใหม่ ออกจากระบบแล้วปุ่มเพิ่ม/แก้ไข/ลบต้องหายไป

หากมีการแก้จากสองแท็บพร้อมกัน ระบบจะให้การบันทึกแรกผ่าน และปฏิเสธการบันทึกด้วยข้อมูลรุ่นเก่า ให้คัดลอกสิ่งที่แก้ไว้ก่อนรีเฟรชแล้วแก้อีกครั้ง

## ใช้งานบนเครื่องระหว่างพัฒนา

คัดลอก `.env.example` เป็น `.env.local` แล้วใส่สองค่าเดียวกัน จากนั้นเปิด `npm run dev` ใหม่ หากยังไม่ตั้งค่า เว็บจะอ่าน `public/articles.json` ให้ดูได้ แต่จะไม่เปิดระบบแก้ไข ถ้าตั้งค่าแล้วเชื่อมต่อไม่ได้ ระบบจะแสดงข้อผิดพลาด ไม่ย้อนกลับไปใช้ข้อมูลเก่าอย่างเงียบๆ

## ขอบเขตข้อมูลและการสำรอง

หลังเชื่อมต่อแล้ว Supabase เป็นแหล่งข้อมูลบทความหลัก `public/articles.json` เป็นข้อมูลเริ่มต้นเท่านั้น ไม่ได้รับการอัปเดตจากหน้าเว็บ ควรสำรองตาราง `archive` ผ่าน Supabase ก่อนแก้ไขชุดใหญ่ และสำรองไฟล์ใน Storage แยกต่างหาก

`npm run check:glossary` ยังตรวจเทียบกับ `public/articles.json` ในเครื่อง หากต้องการตรวจให้ตรงกับเว็บจริง ให้ส่งออกค่า `articles` จากแถว `archive` มาอัปเดตไฟล์ในเครื่องก่อนรัน บทความที่ลบอาจมีลิงก์อ้างอิงอยู่ใน `public/glossary.json` ซึ่งต้องแก้เอง

บทความเก็บเป็นเอกสาร JSON หนึ่งแถวพร้อมเลขรุ่น เหมาะกับคลังขนาดปัจจุบัน และทำให้การเพิ่ม/แก้/ลบทั้งชุดเป็นธุรกรรมเดียว รูปใหม่รองรับ JPG, PNG, WebP, GIF ขนาดไม่เกิน 5 MB ต่อไฟล์ รูปที่เลิกใช้ยังเก็บใน Storage ให้เจ้าของ project ลบเองหลังตรวจว่าไม่มีบทความอ้างอิง

เอกสารอ้างอิง: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [Vercel environment variables](https://vercel.com/docs/environment-variables)
