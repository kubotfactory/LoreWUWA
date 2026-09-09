import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_SUPABASE_')
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (Boolean(url) !== Boolean(key)) {
    throw new Error('Set both VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY; see SUPABASE_SETUP.md.')
  }
  if (key && !key.startsWith('sb_publishable_')) {
    throw new Error('Use a public sb_publishable_ key, never a secret or service_role key in VITE_ variables.')
  }
  return {
    plugins: [vue(), tailwindcss()],
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
    // dev server สำหรับแก้ไขงาน (npm run dev)
    server: {
      host: true, // ฟังทุก network interface ไม่ใช่แค่ localhost
      port: 5173,
      allowedHosts: true, // ยอมรับทุกชื่อโฮสต์ จำเป็นเวลาเข้าผ่าน forward port / โดเมนภายนอก
    },
    // เสิร์ฟไฟล์ที่ build แล้ว (npm run serve / runserver.bat)
    preview: {
      host: true,
      port: 8220,
      strictPort: true, // ถ้าพอร์ตไม่ว่างให้ error ไปเลย จะได้รู้ ไม่ใช่แอบย้ายพอร์ต
      allowedHosts: true,
    },
  }
})
