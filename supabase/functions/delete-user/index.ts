// Edge Function: delete-user
// Dipanggil dari halaman "Manajemen Pengguna" supaya admin bisa menghapus
// akun langsung dari UI. Butuh Service Role Key (tidak boleh ada di
// frontend), makanya harus lewat Edge Function seperti create-user.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Tidak ada sesi login.' }, 401)

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) return json({ error: 'Sesi tidak valid, silakan login ulang.' }, 401)

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Hanya admin yang boleh menghapus pengguna.' }, 403)
    }

    const { user_id } = await req.json()
    if (!user_id) return json({ error: 'user_id wajib diisi.' }, 400)

    if (user_id === caller.id) {
      return json({ error: 'Tidak bisa menghapus akun sendiri yang sedang login.' }, 400)
    }

    // Baris di tabel profiles otomatis ikut terhapus (ON DELETE CASCADE,
    // lihat supabase/05_cascade_delete_user.sql)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id)
    if (deleteError) return json({ error: deleteError.message }, 400)

    return json({ success: true })
  } catch (err) {
    return json({ error: err.message ?? 'Terjadi kesalahan pada server.' }, 500)
  }
})
