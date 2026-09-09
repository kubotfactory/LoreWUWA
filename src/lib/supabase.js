import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://sgttfxksmvgqxbeikfnu.supabase.co'
const DEFAULT_KEY = 'sb_publishable_D6togLhfgTna_C27u3-34Q_gTd2M4Oe'

const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_KEY

// Only the public publishable key belongs in the browser bundle.
export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: typeof window !== 'undefined',
        detectSessionInUrl: false,
      },
    })
  : null

export const backendConfigured = Boolean(supabase)
