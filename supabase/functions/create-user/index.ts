// Edge Function: create-user
// Dipanggil dari halaman "Manajemen Pengguna" di web app supaya admin bisa
// bikin akun baru langsung dari UI, tanpa buka Supabase Dashboard.
//
// Ini WAJIB dijalankan sebagai Edge Function (bukan langsung di frontend)
// karena butuh Service Role Key untuk membuat user lewat Auth Admin API —
// key itu tidak boleh pernah dikirim ke browser.

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

    // 1. Verifikasi siapa yang memanggil (pakai anon key + token dari user yang login)
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser()
    if (callerError || !caller) return json({ error: 'Sesi tidak valid, silakan login ulang.' }, 401)

    // 2. Client dengan Service Role - dipakai untuk cek role & membuat user
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Hanya admin yang boleh menambah pengguna.' }, 403)
    }

    // 3. Ambil data dari body request
    const { email, password, nama, role, warehouse_id } = await req.json()

    if (!email || !password || !nama || !role) {
      return json({ error: 'Email, password, nama, dan role wajib diisi.' }, 400)
    }
    if (password.length < 6) {
      return json({ error: 'Password minimal 6 karakter.' }, 400)
    }
    if (role !== 'admin' && !warehouse_id) {
      return json({ error: 'Gudang wajib dipilih untuk role selain admin.' }, 400)
    }

    // 4. Buat user baru di Supabase Auth
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // langsung aktif, tidak perlu verifikasi email
    })

    if (createError) return json({ error: createError.message }, 400)

    // 5. Trigger `on_auth_user_created` otomatis membuat baris di profiles
    //    dengan role default 'staff_gudang'. Kita update sesuai input admin.
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        nama,
        role,
        warehouse_id: role === 'admin' ? null : warehouse_id,
      })
      .eq('id', created.user.id)

    if (updateError) return json({ error: updateError.message }, 400)

    return json({ success: true, user_id: created.user.id })
  } catch (err) {
    return json({ error: err.message ?? 'Terjadi kesalahan pada server.' }, 500)
  }
})
