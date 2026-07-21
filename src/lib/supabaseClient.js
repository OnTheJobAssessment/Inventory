import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Ini akan muncul di console browser kalau env var belum diisi.
  console.error(
    'Supabase env var belum diisi. Cek file .env (lokal) atau Environment Variables di Vercel (production).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
